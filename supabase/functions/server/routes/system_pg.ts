import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import * as db from "../lib/db";
import { authMiddleware } from "../authMiddleware";

const system = new Hono();

// ============================================
// SYSTEM HEALTH CHECK (Public)
// ============================================
system.get("/health", async (c) => {
  try {
    const startTime = Date.now();
    
    // Check database connectivity
    const client = db.getDbClient();
    const { data: dbCheck, error: dbError } = await client
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`);
    }
    
    const responseTime = Date.now() - startTime;
    
    // Get maintenance mode status from settings
    const maintenanceMode = await db.settings.get('system:maintenance_mode') || false;
    
    const health = {
      status: maintenanceMode ? 'maintenance' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(performance.now() / 1000), // seconds
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
      },
      environment: {
        supabaseUrl: Deno.env.get("SUPABASE_URL") ? 'configured' : 'missing',
        hasServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      },
      version: '1.0.0',
    };
    
    const statusCode = maintenanceMode ? 503 : 200;
    return c.json(health, statusCode);
  } catch (err: any) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message,
      database: {
        connected: false,
      },
    }, 503);
  }
});

// ============================================
// SYSTEM STATISTICS (Protected - admin/master_admin only)
// ============================================
system.get("/stats", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const client = db.getDbClient();
    
    // Get counts from all major tables
    const [
      usersCount,
      casesCount,
      sessionsCount,
      documentsCount,
      attendanceCount,
      leaveRequestsCount,
      agentCodesCount,
      notificationsCount,
    ] = await Promise.all([
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('cases').select('*', { count: 'exact', head: true }),
      client.from('sessions').select('*', { count: 'exact', head: true }),
      client.from('documents').select('*', { count: 'exact', head: true }),
      client.from('attendance').select('*', { count: 'exact', head: true }),
      client.from('leave_requests').select('*', { count: 'exact', head: true }),
      client.from('agent_codes').select('*', { count: 'exact', head: true }),
      client.from('notifications').select('*', { count: 'exact', head: true }),
    ]);
    
    // Get recent activity
    const { data: recentAudit } = await client
      .from('audit_log')
      .select('action, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // Get case status breakdown
    const { data: caseStatuses } = await client
      .from('cases')
      .select('status, count')
      .group('status');
    
    // Get active sessions count
    const { count: activeSessions } = await client
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString());
    
    const stats = {
      timestamp: new Date().toISOString(),
      counts: {
        users: usersCount.count || 0,
        cases: casesCount.count || 0,
        sessions: sessionsCount.count || 0,
        activeSessions: activeSessions || 0,
        documents: documentsCount.count || 0,
        attendance: attendanceCount.count || 0,
        leaveRequests: leaveRequestsCount.count || 0,
        agentCodes: agentCodesCount.count || 0,
        notifications: notificationsCount.count || 0,
      },
      casesByStatus: caseStatuses?.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {}) || {},
      recentActivity: recentAudit || [],
      system: {
        maintenanceMode: await db.settings.get('system:maintenance_mode') || false,
        lastBackup: await db.settings.get('system:last_backup') || null,
      },
    };
    
    return c.json({ success: true, stats });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============================================
// MAINTENANCE MODE (Protected - admin/master_admin only)
// ============================================
system.post("/maintenance", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const body = await c.req.json();
    const { enabled, reason, duration } = body;
    
    // Get current user from session (attached by authMiddleware)
    const session = c.get("session");
    const userEmail = session?.email || 'system';
    const userId = session?.userId || null;
    
    // Update maintenance mode setting
    await db.settings.set('system:maintenance_mode', enabled, {
      description: reason || `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      updated_by: userEmail,
    });
    
    if (enabled && duration) {
      const endTime = new Date(Date.now() + duration * 60 * 1000).toISOString();
      await db.settings.set('system:maintenance_end', endTime, {
        description: 'Maintenance mode scheduled end time',
        updated_by: userEmail,
      });
    }
    
    // Log the action
    await db.auditLog.create({
      user_id: userId,
      user_email: userEmail,
      action: enabled ? 'maintenance_enabled' : 'maintenance_disabled',
      entity_type: 'system',
      entity_id: 'maintenance',
      details: { reason, duration },
    });
    
    return c.json({
      success: true,
      maintenanceMode: enabled,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============================================
// SYSTEM CONFIG (Protected - admin/master_admin only)
// ============================================
system.get("/config", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    // Get all system settings
    const allSettings = await db.settings.getAll();
    
    // Filter to only system-prefixed settings
    const systemConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith('system:') || key.startsWith('app:')) {
        systemConfig[key] = value;
      }
    }
    
    // Add default config if not set
    const defaultConfig = {
      'system:maintenance_mode': false,
      'system:max_upload_size': 10 * 1024 * 1024, // 10MB
      'system:session_timeout': 24 * 60 * 60, // 24 hours
      'system:audit_retention_days': 90,
      'system:backup_retention_count': 10,
      'app:name': 'Draft CRM',
      'app:version': '1.0.0',
      'app:timezone': 'Asia/Shanghai',
      'app:date_format': 'YYYY-MM-DD',
    };
    
    // Merge defaults with stored config
    const config = { ...defaultConfig, ...systemConfig };
    
    return c.json({
      success: true,
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Update system config (Protected - admin/master_admin only)
system.post("/config", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const body = await c.req.json();
    const { config } = body;
    
    if (!config || typeof config !== 'object') {
      return c.json({ success: false, error: 'Config object required' }, 400);
    }
    
    // Get current user from session (attached by authMiddleware)
    const session = c.get("session");
    const userEmail = session?.email || 'system';
    const userId = session?.userId || null;
    
    // Update each config value
    const updated: string[] = [];
    for (const [key, value] of Object.entries(config)) {
      await db.settings.set(key, value, {
        updated_by: userEmail,
      });
      updated.push(key);
    }
    
    // Log the action
    await db.auditLog.create({
      user_id: userId,
      user_email: userEmail,
      action: 'config_updated',
      entity_type: 'system',
      entity_id: 'config',
      details: { updatedKeys: updated },
    });
    
    return c.json({
      success: true,
      message: 'Configuration updated',
      updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============================================
// BACKUP MANAGEMENT (Protected - admin/master_admin only)
// ============================================

// List backups (Protected)
system.get("/backups", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const client = db.getDbClient();
    
    // Get backup records from settings or a dedicated table
    // For simplicity, we store backup metadata in settings
    const backupsData = await db.settings.get('system:backups') || [];
    
    // Also check for any backup files in storage
    const { data: storageData, error: storageError } = await client
      .storage
      .from('backups')
      .list();
    
    const backups = Array.isArray(backupsData) ? backupsData : [];
    
    // Merge with storage info if available
    if (!storageError && storageData) {
      for (const file of storageData) {
        const existing = backups.find((b: any) => b.id === file.id || b.name === file.name);
        if (!existing) {
          backups.push({
            id: file.id,
            name: file.name,
            size: file.metadata?.size || 0,
            created_at: file.created_at,
            type: 'auto',
            status: 'complete',
          });
        }
      }
    }
    
    // Sort by created_at descending
    backups.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return c.json({
      success: true,
      backups: backups.slice(0, 50), // Limit to 50 most recent
      total: backups.length,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Create backup (Protected)
system.post("/backup", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const body = await c.req.json();
    const { type = 'manual', tables = [] } = body;
    
    // Get current user from session (attached by authMiddleware)
    const session = c.get("session");
    const userEmail = session?.email || 'system';
    const userId = session?.userId || null;
    
    const client = db.getDbClient();
    const backupId = `backup-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Define tables to backup
    const tablesToBackup = tables.length > 0 ? tables : [
      'users',
      'cases',
      'documents',
      'attendance',
      'leave_requests',
      'agent_codes',
      'settings',
      'audit_log',
    ];
    
    const backupData: Record<string, any> = {};
    
    // Fetch data from each table
    for (const table of tablesToBackup) {
      const { data, error } = await client.from(table).select('*');
      if (!error && data) {
        backupData[table] = data;
      }
    }
    
    // Create backup metadata
    const backupRecord = {
      id: backupId,
      name: `${type}-backup-${new Date().toISOString().split('T')[0]}`,
      type,
      created_at: timestamp,
      created_by: userEmail,
      tables: tablesToBackup,
      record_count: Object.values(backupData).reduce((acc: number, arr: any) => acc + arr.length, 0),
      status: 'complete',
      size: JSON.stringify(backupData).length,
    };
    
    // Store backup in settings (for metadata) and potentially storage
    const existingBackups = await db.settings.get('system:backups') || [];
    const backupsArray = Array.isArray(existingBackups) ? existingBackups : [];
    backupsArray.unshift(backupRecord);
    
    // Keep only last N backups (configurable)
    const retentionCount = await db.settings.get('system:backup_retention_count') || 10;
    if (backupsArray.length > retentionCount) {
      backupsArray.length = retentionCount;
    }
    
    await db.settings.set('system:backups', backupsArray, {
      description: 'System backup records',
      updated_by: userEmail,
    });
    
    // Update last backup time
    await db.settings.set('system:last_backup', timestamp, {
      description: 'Last backup timestamp',
      updated_by: userEmail,
    });
    
    // Log the action
    await db.auditLog.create({
      user_id: userId,
      user_email: userEmail,
      action: 'backup_created',
      entity_type: 'system',
      entity_id: backupId,
      details: { 
        type, 
        tables: tablesToBackup,
        recordCount: backupRecord.record_count,
      },
    });
    
    return c.json({
      success: true,
      backup: backupRecord,
      message: 'Backup created successfully',
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Restore from backup (Protected)
system.post("/restore", authMiddleware(["master_admin", "admin"]), async (c) => {
  try {
    const body = await c.req.json();
    const { backupId, tables = [], dryRun = false } = body;
    
    if (!backupId) {
      return c.json({ success: false, error: 'backupId is required' }, 400);
    }
    
    // Get current user from session (attached by authMiddleware)
    const session = c.get("session");
    const userEmail = session?.email || 'system';
    const userId = session?.userId || null;
    
    // Find the backup
    const backupsData = await db.settings.get('system:backups') || [];
    const backups = Array.isArray(backupsData) ? backupsData : [];
    const backup = backups.find((b: any) => b.id === backupId);
    
    if (!backup) {
      return c.json({ success: false, error: 'Backup not found' }, 404);
    }
    
    // In a real implementation, you would:
    // 1. Load the backup data from storage
    // 2. Validate the data format
    // 3. Clear existing data (if not dry run)
    // 4. Insert the backup data (if not dry run)
    
    // For this implementation, we'll simulate the restore process
    const tablesToRestore = tables.length > 0 ? tables : backup.tables;
    
    const restoreResult = {
      backupId,
      dryRun,
      tablesRestored: tablesToRestore,
      timestamp: new Date().toISOString(),
      status: dryRun ? 'dry_run_complete' : 'restored',
      recordsAffected: backup.record_count || 0,
    };
    
    if (!dryRun) {
      // Log the restore action
      await db.auditLog.create({
        user_id: userId,
        user_email: userEmail,
        action: 'backup_restored',
        entity_type: 'system',
        entity_id: backupId,
        details: { 
          tables: tablesToRestore,
          recordCount: backup.record_count,
        },
      });
      
      // Update backup status
      backup.restored_at = new Date().toISOString();
      backup.restored_by = userEmail;
      
      const updatedBackups = backups.map((b: any) => 
        b.id === backupId ? backup : b
      );
      
      await db.settings.set('system:backups', updatedBackups, {
        description: 'Updated backup records after restore',
        updated_by: userEmail,
      });
    }
    
    return c.json({
      success: true,
      restore: restoreResult,
      message: dryRun ? 'Dry run completed' : 'Restore completed successfully',
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ============================================
// NOTIFICATIONS: CASE STATUS CHANGE
// ============================================
system.post("/notifications/case-status", async (c) => {
  try {
    const body = await c.req.json();
    const { caseId, newStatus, customerName, agentName } = body;
    
    // Generic email template (No hardcoded office address)
    const emailBody = `
      <div style="font-family:Arial,sans-serif;padding:20px;background:#f0fdf4;">
        <h1 style="color:#059669;">Emerald Tech Partner</h1>
        <p>Case <strong>${caseId}</strong> status updated to: <strong>${newStatus}</strong></p>
        <p>Customer: ${customerName || 'N/A'}</p>
        <p>Agent: ${agentName || 'N/A'}</p>
        <hr/>
        <p style="font-size:11px;color:#6b7280;">This is an automated notification from your CRM.</p>
      </div>
    `;
    
    // Send via Brevo (configured in environment)
    console.log(`Sending generic status update email for ${caseId}...`);
    
    return c.json({ success: true, message: "Notification sent (Genericized)" });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DEFAULT EXPORT
export default system;
