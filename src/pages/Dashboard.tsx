import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  Briefcase,
  Upload,
  TrendingUp,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface Stats {
  cases: number;
  documents: number;
  pendingCases: number;
}

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ cases: 0, documents: 0, pendingCases: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile?.organization_id) return;
      const orgId = profile.organization_id;

      const [{ count: cases }, { count: documents }, { count: pending }] = await Promise.all([
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'initial_consultation'),
      ]);

      setStats({
        cases: cases || 0,
        documents: documents || 0,
        pendingCases: pending || 0,
      });
      setLoading(false);
    };

    fetchStats();
  }, [profile?.organization_id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', active: true },
    { icon: Briefcase, label: 'Cases', path: '/cases' },
    { icon: FileText, label: 'Documents', path: '/documents' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-emerald-600">Emerald CRM</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{profile?.organizations?.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-semibold">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-emerald-600">Emerald CRM</h1>
          <button
            onClick={handleSignOut}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Welcome */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back, {profile?.full_name || 'Admin'} 👋
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Here's what's happening in your organization today.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cases</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '-' : stats.cases}</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Documents</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '-' : stats.documents}</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending Cases</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '-' : stats.pendingCases}</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Clients</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '-' : 1}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/documents"
                  className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-emerald-500 hover:shadow-sm transition-all group"
                >
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30">
                    <Upload className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Upload Document</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Add passports, visas, contracts</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </Link>

                <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">New Case</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Coming in next update</p>
                  </div>
                </div>

                <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Invite Team</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Coming in next update</p>
                  </div>
                </div>

                <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-60 cursor-not-allowed">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Reports</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Coming in next update</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-xl shadow-sm text-white">
              <h3 className="text-lg font-semibold mb-2">Pro Tip</h3>
              <p className="text-emerald-100 text-sm">
                Upload client documents to keep everything organized in one place. All files are securely stored and isolated per organization.
              </p>
              <Link
                to="/documents"
                className="inline-flex items-center mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Go to Documents
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
