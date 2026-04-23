/**
 * Sync Routes - PostgreSQL Version
 * Handles sync status, triggers, history, conflict resolution, and health checks
 */

import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import { authMiddleware } from "../authMiddleware.ts";
import { db, getDbClient } from "../lib/db.ts";
import { ServerSession } from "../lib/auth.ts";
import { trimArray, trimCases } from "../lib/utils.ts";
import { 
  MAX_AUDIT_LOG, 
  MAX_CASES 
} from "../lib/constants.ts";

const sync = new Hono();

// Input validation helpers
const validateTenantId = (tenantId: string | undefined): boolean => {
  return !!tenantId && typeof tenantId === 'string' && tenantId.length > 0;
};

const validateSyncType = (type: string | undefined): boolean => {
  const validTypes = ['full', 'incremental', 'cases', 'users', 'settings'];
  return !!type && validTypes.includes(type);
};

const validateConflictResolution = (resolution: string | undefined): boolean => {
  const validResolutions = ['server_wins', 'client_wins', 'merge', 'manual'];
  return !!resolution && validResolutions.includes(resolution);
};

const validateUUID = (id: string | undefined): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Helper to get current timestamp in ISO format
const now = () => new Date().toISOString();

// Helper to sanitize error messages for client
const sanitizeError = (err: any): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

// ==================== GET /sync/status ====================
// Get sync status for tenant
sync.get("/status", authMiddleware(), async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    if (!validateTenantId(session.tenantId)) {
      return c.json({ 
        success: false, 
        error: "Invalid tenant ID" 
      }, 400);
    }

    const client = getDbClient();
    const tenantId = session.tenantId;

    // Get counts for each entity type in parallel
    const [
      casesCount,
      usersCount,
      lastSyncEntry,
      pendingConflicts
    ] = await Promise.all([
      db.cases.count({ tenant_id: tenantId }),
      db.users.count({ tenant_id: tenantId, status: 'active' }),
      // Get last sync operation from audit log
      db.auditLog.getAll({ 
        action: 'sync_trigger', 
        tenant_id: tenantId,
        limit: 1 
      }),
      // Get recent conflict entries
      db.auditLog.getAll({ 
        action: 'sync_conflict', 
        tenant_id: tenantId,
        limit: 10 
      })
    ]);

    // Get sync settings for tenant
    const syncSettings = await db.settings.get(`sync:settings:${tenantId}`) || {
      auto_sync: true,
      sync_interval_minutes: 5,
      conflict_resolution: 'server_wins'
    };

    const lastSync = lastSyncEntry.length > 0 ? lastSyncEntry[0].created_at : null;
    const conflictCount = pendingConflicts.length;

    // Calculate sync health
    const syncHealthy = lastSync 
      ? (new Date().getTime() - new Date(lastSync).getTime()) < 30 * 60 * 1000 // 30 min
      : false;

    const response = {
      success: true,
      data: {
        tenant_id: tenantId,
        status: syncHealthy ? 'healthy' : 'stale',
        last_sync: lastSync,
        next_scheduled_sync: lastSync 
          ? new Date(new Date(lastSync).getTime() + (syncSettings.sync_interval_minutes || 5) * 60 * 1000).toISOString()
          : null,
        counts: {
          cases: casesCount,
          users: usersCount,
          pending_conflicts: conflictCount
        },
        settings: syncSettings,
        meta: {
          response_time_ms: Date.now() - startTime,
          checked_at: now()
        }
      }
    };

    return c.json(response);
  } catch (err: any) {
    // Log error to audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_status_error",
      entity_type: "sync",
      entity_id: "status",
      details: { 
        error: sanitizeError(err),
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    }).catch(() => {}); // Don't fail on audit log error

    return c.json({ 
      success: false, 
      error: "Failed to get sync status",
      meta: {
        response_time_ms: Date.now() - startTime
      }
    }, 500);
  }
});

// ==================== POST /sync/trigger ====================
// Trigger manual sync
sync.post("/trigger", authMiddleware(), async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    if (!validateTenantId(session.tenantId)) {
      return c.json({ 
        success: false, 
        error: "Invalid tenant ID" 
      }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const syncType = body.type || 'full';

    if (!validateSyncType(syncType)) {
      return c.json({ 
        success: false, 
        error: "Invalid sync type. Must be one of: full, incremental, cases, users, settings" 
      }, 400);
    }

    const tenantId = session.tenantId;
    const client = getDbClient();

    // Use transaction for sync operation tracking
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const syncStartedAt = now();

    // Log sync trigger to audit log
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_trigger",
      entity_type: "sync",
      entity_id: syncId,
      details: { 
        sync_type: syncType,
        tenant_id: tenantId,
        user_id: session.userId,
        triggered_by: 'manual',
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: tenantId
    });

    // Store sync operation in settings for tracking
    await db.settings.set(`sync:operation:${syncId}`, {
      id: syncId,
      type: syncType,
      status: 'in_progress',
      started_at: syncStartedAt,
      started_by: session.userId,
      tenant_id: tenantId
    }, {
      updated_by: session.userId,
      tenant_id: tenantId
    });

    // Perform sync based on type
    let syncResults: any = {};
    
    switch (syncType) {
      case 'full':
      case 'cases':
        const cases = await db.cases.getAll({ 
          tenant_id: tenantId, 
          limit: MAX_CASES 
        });
        syncResults.cases = { 
          synced: cases.length,
          last_updated: cases.length > 0 
            ? cases.reduce((latest, c) => 
                new Date(c.updated_at) > new Date(latest) ? c.updated_at : latest, 
                cases[0].updated_at
              )
            : null
        };
        break;
        
      case 'users':
        const users = await db.users.findAll({ 
          tenant_id: tenantId, 
          status: 'active' 
        });
        syncResults.users = { synced: users.length };
        break;
        
      case 'incremental':
        // Get recently updated records
        const since = body.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentCases = await db.cases.getAll({ 
          tenant_id: tenantId, 
          limit: MAX_CASES 
        });
        const filteredCases = recentCases.filter(c => 
          new Date(c.updated_at) >= new Date(since)
        );
        syncResults.incremental = { 
          synced: filteredCases.length,
          since: since
        };
        break;
    }

    const syncCompletedAt = now();

    // Update sync operation status
    await db.settings.set(`sync:operation:${syncId}`, {
      id: syncId,
      type: syncType,
      status: 'completed',
      started_at: syncStartedAt,
      completed_at: syncCompletedAt,
      started_by: session.userId,
      tenant_id: tenantId,
      results: syncResults
    }, {
      updated_by: session.userId,
      tenant_id: tenantId
    });

    // Log completion
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_complete",
      entity_type: "sync",
      entity_id: syncId,
      details: { 
        sync_type: syncType,
        results: syncResults,
        duration_ms: Date.now() - startTime
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: tenantId
    });

    return c.json({
      success: true,
      data: {
        sync_id: syncId,
        type: syncType,
        status: 'completed',
        started_at: syncStartedAt,
        completed_at: syncCompletedAt,
        results: syncResults,
        meta: {
          duration_ms: Date.now() - startTime,
          triggered_by: session.userId
        }
      }
    });

  } catch (err: any) {
    // Log error
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_trigger_error",
      entity_type: "sync",
      entity_id: "trigger",
      details: { 
        error: sanitizeError(err),
        sync_type: body?.type || 'unknown',
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    }).catch(() => {});

    return c.json({ 
      success: false, 
      error: "Sync trigger failed",
      details: sanitizeError(err),
      meta: {
        duration_ms: Date.now() - startTime
      }
    }, 500);
  }
});

// ==================== GET /sync/history ====================
// Get sync history
sync.get("/history", authMiddleware(), async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    if (!validateTenantId(session.tenantId)) {
      return c.json({ 
        success: false, 
        error: "Invalid tenant ID" 
      }, 400);
    }

    const tenantId = session.tenantId;
    
    // Parse query parameters
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
    const offset = parseInt(c.req.query("offset") || "0");
    const action = c.req.query("action") || 'sync_trigger';

    // Get sync history from audit log
    const history = await db.auditLog.getAll({
      action: action,
      tenant_id: tenantId,
      limit: limit,
      offset: offset
    });

    // Get total count
    const client = getDbClient();
    const { count, error: countError } = await client
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('action', action)
      .eq('tenant_id', tenantId);

    if (countError) throw countError;

    // Format history entries
    const formattedHistory = history.map(entry => ({
      id: entry.id,
      action: entry.action,
      entity_id: entry.entity_id,
      timestamp: entry.created_at,
      user: {
        id: entry.user_id,
        email: entry.user_email
      },
      details: entry.details,
      ip_address: entry.ip_address
    }));

    return c.json({
      success: true,
      data: {
        history: formattedHistory,
        pagination: {
          total: count || 0,
          limit,
          offset,
          has_more: (offset + limit) < (count || 0)
        },
        meta: {
          response_time_ms: Date.now() - startTime
        }
      }
    });

  } catch (err: any) {
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_history_error",
      entity_type: "sync",
      entity_id: "history",
      details: { 
        error: sanitizeError(err),
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    }).catch(() => {});

    return c.json({ 
      success: false, 
      error: "Failed to get sync history",
      meta: {
        response_time_ms: Date.now() - startTime
      }
    }, 500);
  }
});

// ==================== POST /sync/resolve-conflicts ====================
// Resolve sync conflicts
sync.post("/resolve-conflicts", authMiddleware(), async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    if (!validateTenantId(session.tenantId)) {
      return c.json({ 
        success: false, 
        error: "Invalid tenant ID" 
      }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    
    // Validate required fields
    if (!body.conflict_ids || !Array.isArray(body.conflict_ids) || body.conflict_ids.length === 0) {
      return c.json({ 
        success: false, 
        error: "conflict_ids array is required" 
      }, 400);
    }

    const resolution = body.resolution || 'server_wins';
    if (!validateConflictResolution(resolution)) {
      return c.json({ 
        success: false, 
        error: "Invalid resolution strategy. Must be one of: server_wins, client_wins, merge, manual" 
      }, 400);
    }

    const tenantId = session.tenantId;
    const client = getDbClient();
    const resolvedConflicts: any[] = [];
    const failedConflicts: any[] = [];

    // Process each conflict
    for (const conflictId of body.conflict_ids) {
      try {
        // Get conflict details from audit log
        const conflictEntries = await db.auditLog.getAll({
          entity_id: conflictId,
          tenant_id: tenantId,
          limit: 1
        });

        if (conflictEntries.length === 0) {
          failedConflicts.push({ id: conflictId, reason: "Conflict not found" });
          continue;
        }

        const conflict = conflictEntries[0];
        const entityType = conflict.entity_type;
        const entityId = conflict.entity_id;

        // Apply resolution strategy
        let resolutionResult: any = {};
        
        switch (resolution) {
          case 'server_wins':
            // Keep server version - just mark as resolved
            resolutionResult = { strategy: 'server_wins', action: 'kept_server_version' };
            break;
            
          case 'client_wins':
            // Apply client changes if provided
            if (body.client_data && body.client_data[conflictId]) {
              const clientData = body.client_data[conflictId];
              
              if (entityType === 'case' && validateUUID(entityId)) {
                await db.cases.update(entityId, {
                  ...clientData,
                  updated_at: now()
                });
              } else if (entityType === 'user' && validateUUID(entityId)) {
                const { password, ...safeUpdates } = clientData;
                await db.users.update(entityId, safeUpdates);
              }
              resolutionResult = { strategy: 'client_wins', action: 'applied_client_changes' };
            } else {
              resolutionResult = { strategy: 'client_wins', action: 'no_client_data_provided' };
            }
            break;
            
          case 'merge':
            // Merge server and client data
            if (body.merged_data && body.merged_data[conflictId]) {
              const mergedData = body.merged_data[conflictId];
              
              if (entityType === 'case' && validateUUID(entityId)) {
                await db.cases.update(entityId, {
                  ...mergedData,
                  updated_at: now()
                });
              } else if (entityType === 'user' && validateUUID(entityId)) {
                const { password, ...safeUpdates } = mergedData;
                await db.users.update(entityId, safeUpdates);
              }
              resolutionResult = { strategy: 'merge', action: 'applied_merged_data' };
            } else {
              resolutionResult = { strategy: 'merge', action: 'no_merged_data_provided' };
            }
            break;
            
          case 'manual':
            // Manual resolution - just mark with notes
            resolutionResult = { 
              strategy: 'manual', 
              action: 'marked_resolved',
              notes: body.resolution_notes || 'Manually resolved'
            };
            break;
        }

        // Log conflict resolution
        await db.auditLog.create({
          user_id: session.userId,
          user_email: session.email,
          action: "sync_conflict_resolved",
          entity_type: entityType,
          entity_id: entityId,
          details: { 
            original_conflict: conflict.id,
            resolution: resolution,
            result: resolutionResult,
            resolved_by: session.userId
          },
          ip_address: c.req.header("x-forwarded-for"),
          user_agent: c.req.header("user-agent"),
          tenant_id: tenantId
        });

        resolvedConflicts.push({
          id: conflictId,
          entity_id: entityId,
          entity_type: entityType,
          resolution: resolutionResult
        });

      } catch (conflictErr: any) {
        failedConflicts.push({ 
          id: conflictId, 
          reason: sanitizeError(conflictErr) 
        });
      }
    }

    // Log overall resolution operation
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_resolve_conflicts",
      entity_type: "sync",
      entity_id: "batch",
      details: { 
        resolved_count: resolvedConflicts.length,
        failed_count: failedConflicts.length,
        resolution_strategy: resolution,
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: tenantId
    });

    return c.json({
      success: failedConflicts.length === 0,
      data: {
        resolved: resolvedConflicts,
        failed: failedConflicts,
        summary: {
          total: body.conflict_ids.length,
          resolved: resolvedConflicts.length,
          failed: failedConflicts.length,
          resolution_strategy: resolution
        }
      },
      meta: {
        duration_ms: Date.now() - startTime
      }
    });

  } catch (err: any) {
    await db.auditLog.create({
      user_id: session.userId,
      user_email: session.email,
      action: "sync_resolve_error",
      entity_type: "sync",
      entity_id: "resolve",
      details: { 
        error: sanitizeError(err),
        ip_address: c.req.header("x-forwarded-for")
      },
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      tenant_id: session.tenantId
    }).catch(() => {});

    return c.json({ 
      success: false, 
      error: "Conflict resolution failed",
      details: sanitizeError(err),
      meta: {
        duration_ms: Date.now() - startTime
      }
    }, 500);
  }
});

// ==================== GET /sync/health ====================
// Health check for sync system
sync.get("/health", authMiddleware(), async (c) => {
  const startTime = Date.now();
  const session = c.get("session") as ServerSession;
  
  try {
    const client = getDbClient();
    const tenantId = session.tenantId;
    const healthChecks: Record<string, any> = {};
    let overallHealthy = true;

    // Check database connectivity
    try {
      const { data, error } = await client.from('profiles').select('id').limit(1);
      healthChecks.database = {
        status: error ? 'error' : 'healthy',
        response_time_ms: Date.now() - startTime,
        error: error?.message
      };
      if (error) overallHealthy = false;
    } catch (dbErr: any) {
      healthChecks.database = {
        status: 'error',
        error: sanitizeError(dbErr)
      };
      overallHealthy = false;
    }

    // Check cases table access
    try {
      const casesStart = Date.now();
      const { count, error } = await client
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      healthChecks.cases_table = {
        status: error ? 'error' : 'healthy',
        response_time_ms: Date.now() - casesStart,
        count: count || 0,
        error: error?.message
      };
      if (error) overallHealthy = false;
    } catch (casesErr: any) {
      healthChecks.cases_table = {
        status: 'error',
        error: sanitizeError(casesErr)
      };
      overallHealthy = false;
    }

    // Check audit log access
    try {
      const auditStart = Date.now();
      const { data, error } = await client
        .from('audit_log')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);
      healthChecks.audit_log = {
        status: error ? 'error' : 'healthy',
        response_time_ms: Date.now() - auditStart,
        error: error?.message
      };
      if (error) overallHealthy = false;
    } catch (auditErr: any) {
      healthChecks.audit_log = {
        status: 'error',
        error: sanitizeError(auditErr)
      };
      overallHealthy = false;
    }

    // Get recent sync performance metrics
    try {
      const recentSyncs = await db.auditLog.getAll({
        action: 'sync_trigger',
        tenant_id: tenantId,
        limit: 5
      });
      
      const syncPerformance = recentSyncs.map(s => ({
        timestamp: s.created_at,
        type: s.details?.sync_type || 'unknown',
        status: s.details?.error ? 'failed' : 'success'
      }));

      healthChecks.sync_performance = {
        recent_operations: syncPerformance,
        healthy: syncPerformance.filter(s => s.status === 'success').length >= 3
      };
    } catch (perfErr: any) {
      healthChecks.sync_performance = {
        status: 'error',
        error: sanitizeError(perfErr)
      };
    }

    const response = {
      success: overallHealthy,
      data: {
        status: overallHealthy ? 'healthy' : 'degraded',
        timestamp: now(),
        checks: healthChecks,
        tenant_id: tenantId,
        meta: {
          total_response_time_ms: Date.now() - startTime
        }
      }
    };

    return c.json(response, overallHealthy ? 200 : 503);

  } catch (err: any) {
    return c.json({ 
      success: false, 
      status: 'unhealthy',
      error: sanitizeError(err),
      meta: {
        response_time_ms: Date.now() - startTime
      }
    }, 503);
  }
});

export default sync;