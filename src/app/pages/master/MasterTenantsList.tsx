import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Users, CheckCircle, XCircle, Clock,
  RefreshCw, Shield, Crown, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { TenantService, type Tenant } from '../../lib/tenantService';
import { useTheme } from '../../lib/ThemeContext';
import { toast } from '../../lib/toast';
import { useUnifiedLayout } from '../../components/UnifiedLayout';
import { MasterSidebar } from '../../components/MasterSidebar';
import { MasterHeader } from '../../components/MasterHeader';

const STATUS_CONFIG: Record<Tenant['status'], { label: string; color: string; icon: typeof CheckCircle }> = {
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700  dark:bg-green-900/40  dark:text-green-400',  icon: CheckCircle },
  trial:     { label: 'Trial',     color: 'bg-blue-100  text-blue-700   dark:bg-blue-900/40   dark:text-blue-400',   icon: Clock },
  suspended: { label: 'Suspended', color: 'bg-red-100   text-red-700    dark:bg-red-900/40    dark:text-red-400',    icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100  text-gray-500   dark:bg-gray-800      dark:text-gray-500',   icon: AlertTriangle },
};

export function MasterTenantsList() {
  const { darkMode } = useTheme();
  const dc = darkMode;
  const txt = dc ? 'text-white' : 'text-gray-900';
  const sub = dc ? 'text-gray-400' : 'text-gray-500';
  const cardBg = `${dc ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border rounded-xl`;

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { insideUnifiedLayout } = useUnifiedLayout();

  const fetchTenants = async () => {
    setLoading(true);
    const { tenants: data, error } = await TenantService.getAllTenants();
    if (error) toast.error(`Failed to load tenants: ${error}`);
    else setTenants(data);
    setLoading(false);
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus: Tenant['status'] = tenant.status === 'active' ? 'suspended' : 'active';
    setActionLoading(tenant.id);
    const result = await TenantService.updateTenantStatus(tenant.id, newStatus);
    if (!result.success) {
      toast.error(result.error || 'Action failed');
    } else {
      toast.success(`${tenant.name} is now ${newStatus}`);
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: newStatus } : t));
    }
    setActionLoading(null);
  };

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = [
    { label: 'Total Agencies', value: tenants.length,                                                         icon: Building2,   color: 'from-purple-500 to-purple-600' },
    { label: 'Active',         value: tenants.filter(t => t.status === 'active').length,                      icon: CheckCircle, color: 'from-green-500 to-emerald-600' },
    { label: 'On Trial',       value: tenants.filter(t => t.status === 'trial').length,                       icon: Clock,       color: 'from-blue-500 to-blue-600' },
    { label: 'Suspended',      value: tenants.filter(t => t.status === 'suspended' || t.status === 'cancelled').length, icon: XCircle, color: 'from-red-500 to-red-600' },
    { label: 'Total Users',    value: tenants.reduce((acc, t) => acc + (t.user_count ?? 0), 0),               icon: Users,       color: 'from-amber-500 to-amber-600' },
  ];

  return (
    <div className={`${insideUnifiedLayout ? '' : 'flex min-h-screen'} transition-colors duration-300 ${dc ? 'bg-gray-950' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? '' : 'pt-14 lg:pt-0'}`}>
        {!insideUnifiedLayout && <MasterHeader />}

        <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
          {/* Page header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${txt}`}>Tenant Management</h1>
                <p className={`text-xs ${sub}`}>All registered agencies on this platform</p>
              </div>
            </div>
            <button
              id="refresh-tenants"
              onClick={fetchTenants}
              disabled={loading}
              className={`p-2 rounded-xl border transition-colors ${dc ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'} ${sub}`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </motion.div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`${cardBg} p-4`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <p className={`text-2xl font-bold tabular-nums ${txt}`}>{s.value}</p>
                <p className={`text-xs ${sub}`}>{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Tenants table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`${cardBg} overflow-hidden`}
          >
            <div className={`px-5 py-4 border-b ${dc ? 'border-gray-800' : 'border-gray-100'} flex items-center justify-between`}>
              <h2 className={`font-semibold ${txt}`}>All Agencies</h2>
              <TrendingUp className={`w-4 h-4 ${sub}`} />
            </div>

            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : tenants.length === 0 ? (
              <div className={`p-12 text-center ${sub}`}>
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No agencies registered yet</p>
                <p className="text-xs mt-1">When agencies sign up, they will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-xs font-semibold uppercase tracking-wider ${sub} ${dc ? 'bg-gray-800/40' : 'bg-gray-50'}`}>
                      <th className="px-5 py-3 text-left">Agency</th>
                      <th className="px-5 py-3 text-left">Owner</th>
                      <th className="px-5 py-3 text-center">Users</th>
                      <th className="px-5 py-3 text-center">Max Users</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3 text-center">Joined</th>
                      <th className="px-5 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dc ? 'divide-gray-800' : 'divide-gray-100'}`}>
                    {tenants.map((tenant, idx) => {
                      const sc = STATUS_CONFIG[tenant.status];
                      const isActionLoading = actionLoading === tenant.id;
                      return (
                        <motion.tr
                          key={tenant.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + idx * 0.05 }}
                          className={`group ${dc ? 'hover:bg-gray-800/40' : 'hover:bg-gray-50'} transition-colors`}
                        >
                          {/* Agency Name */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">{tenant.name.charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <p className={`font-semibold ${txt}`}>{tenant.name}</p>
                                <p className={`text-xs ${sub}`}>{tenant.domain || 'No domain'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Owner */}
                          <td className="px-5 py-4">
                            <p className={`font-medium ${txt}`}>{tenant.owner_name}</p>
                            <p className={`text-xs ${sub}`}>{tenant.owner_email}</p>
                          </td>

                          {/* User Count */}
                          <td className="px-5 py-4 text-center">
                            <span className={`font-semibold tabular-nums ${txt}`}>{tenant.user_count ?? 0}</span>
                          </td>

                          {/* Max Users */}
                          <td className="px-5 py-4 text-center">
                            <span className={`text-xs ${sub}`}>{tenant.max_users}</span>
                          </td>

                          {/* Status Badge */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.color}`}>
                              <sc.icon className="w-3 h-3" />
                              {sc.label}
                            </span>
                          </td>

                          {/* Joined Date */}
                          <td className={`px-5 py-4 text-center text-xs ${sub}`}>
                            {new Date(tenant.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>

                          {/* Toggle Action */}
                          <td className="px-5 py-4 text-center">
                            <button
                              id={`toggle-tenant-${tenant.id}`}
                              onClick={() => handleToggleStatus(tenant)}
                              disabled={isActionLoading || tenant.status === 'cancelled'}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 mx-auto ${
                                tenant.status === 'active' || tenant.status === 'trial'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                              }`}
                            >
                              {isActionLoading ? (
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              ) : tenant.status === 'active' || tenant.status === 'trial' ? (
                                <><XCircle className="w-3 h-3" /> Suspend</>
                              ) : (
                                <><CheckCircle className="w-3 h-3" /> Activate</>
                              )}
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Security note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`flex items-center gap-2.5 text-xs ${sub} p-4 rounded-xl border ${dc ? 'border-gray-800 bg-gray-900/50' : 'border-gray-100 bg-gray-50'}`}
          >
            <Shield className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            <span>
              This page is only visible to <strong>Super Admins</strong> (you). Supabase RLS enforces data isolation — suspended tenants cannot access any data.
            </span>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
