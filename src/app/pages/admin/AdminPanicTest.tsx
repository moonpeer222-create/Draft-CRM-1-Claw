import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Shield, Zap, CheckCircle, XCircle, Clock, Globe, RefreshCw, AlertTriangle } from "lucide-react";
import { triggerPanic } from "../../lib/panicMode";
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { toast } from "../../lib/toast";

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/admin_pg`;

export function AdminPanicTest() {
  const [serverStatus, setServerStatus] = useState<{
    active: boolean;
    timestamp: number | null;
    checking: boolean;
  }>({
    active: false,
    timestamp: null,
    checking: false,
  });
  
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const checkServerStatus = async () => {
    setServerStatus(prev => ({ ...prev, checking: true }));
    addLog("Checking server panic status...");
    
    try {
      const response = await fetch(`${SERVER_URL}/api/panic/status`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      
      setServerStatus({
        active: data.active,
        timestamp: data.timestamp,
        checking: false,
      });
      
      addLog(`Server status: ${data.active ? '🚨 PANIC ACTIVE' : '✅ Normal'}`);
    } catch (err) {
      addLog(`❌ Error checking status: ${err}`);
      setServerStatus(prev => ({ ...prev, checking: false }));
    }
  };

  const clearServerPanic = async () => {
    addLog("Clearing server panic flag...");
    try {
      const response = await fetch(`${SERVER_URL}/api/panic/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        addLog("✅ Server panic flag cleared");
        toast.success("Panic flag cleared successfully");
        await checkServerStatus();
      } else {
        addLog("❌ Failed to clear panic flag");
        toast.error("Failed to clear panic flag");
      }
    } catch (err) {
      addLog(`❌ Error clearing panic: ${err}`);
      toast.error("Error clearing panic flag");
    }
  };

  const triggerTestPanic = () => {
    addLog("🚨 TRIGGERING PANIC MODE - This tab will self-destruct in 3 seconds!");
    toast.error("PANIC MODE TRIGGERED! Redirecting to decoy...", { duration: 3000 });
    
    setTimeout(() => {
      triggerPanic();
    }, 3000);
  };

  useEffect(() => {
    checkServerStatus();
    
    // Auto-refresh status every 3 seconds
    const interval = setInterval(checkServerStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">Nuclear Panic Mode Test</h1>
              <p className="text-gray-400">Cross-Device Kill Switch System</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={checkServerStatus}
              className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Server Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Server Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {serverStatus.checking ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-6 h-6 text-blue-400" />
                  </motion.div>
                ) : serverStatus.active ? (
                  <XCircle className="w-6 h-6 text-red-400" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                )}
                <div>
                  <p className="text-sm text-gray-400">Panic Status</p>
                  <p className={`font-bold ${serverStatus.active ? 'text-red-400' : 'text-green-400'}`}>
                    {serverStatus.checking ? 'Checking...' : serverStatus.active ? '🚨 ACTIVE' : '✅ Normal'}
                  </p>
                </div>
              </div>
            </div>

            {serverStatus.timestamp && (
              <div className="bg-gray-700/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Last Trigger</p>
                    <p className="font-bold text-white">
                      {new Date(serverStatus.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Actions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trigger Panic */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={triggerTestPanic}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white p-6 rounded-xl font-bold text-lg shadow-lg shadow-red-500/30 flex flex-col items-center gap-3"
            >
              <Zap className="w-8 h-8" />
              <span>Trigger Panic Mode</span>
              <span className="text-xs font-normal opacity-80">
                (This tab will self-destruct)
              </span>
            </motion.button>

            {/* Clear Panic */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={clearServerPanic}
              disabled={!serverStatus.active}
              className="bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white p-6 rounded-xl font-bold text-lg shadow-lg shadow-green-500/30 flex flex-col items-center gap-3"
            >
              <CheckCircle className="w-8 h-8" />
              <span>Clear Panic Flag</span>
              <span className="text-xs font-normal opacity-80">
                {serverStatus.active ? '(Panic is active)' : '(No panic active)'}
              </span>
            </motion.button>
          </div>
        </motion.div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-yellow-900/20 border border-yellow-600/30 rounded-2xl p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-yellow-400 font-bold mb-2">⚠️ Warning</h3>
              <ul className="text-yellow-200/80 text-sm space-y-1 list-disc list-inside">
                <li>Triggering panic will CLOSE THIS TAB and redirect to a decoy URL</li>
                <li>All CRM sessions across ALL DEVICES will be terminated</li>
                <li>Only session data is wiped - CRM data (cases, profiles) is preserved</li>
                <li>To recover: Open any login page and sign in again</li>
                <li>Cross-device kill takes up to 3 seconds</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Logs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl p-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">Activity Log</h2>
          
          <div className="bg-gray-900/50 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity yet...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300 mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Test Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-blue-900/20 border border-blue-600/30 rounded-2xl p-6"
        >
          <h2 className="text-blue-400 font-bold mb-3">🧪 Testing Guide</h2>
          <div className="text-blue-200/80 text-sm space-y-2">
            <p><strong>Test 1: Same-Device Kill</strong></p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Open this test page in multiple tabs</li>
              <li>Click "Trigger Panic Mode" in one tab</li>
              <li>All tabs should close/redirect within 100ms</li>
            </ol>
            
            <p className="mt-4"><strong>Test 2: Cross-Device Kill</strong></p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Open this page on Device A</li>
              <li>Open this page on Device B (different computer/phone)</li>
              <li>Trigger panic from Device A</li>
              <li>Device B should self-destruct within 3 seconds</li>
            </ol>
            
            <p className="mt-4"><strong>Test 3: Recovery</strong></p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Trigger panic</li>
              <li>Open /admin/login page</li>
              <li>Server panic flag should be auto-cleared</li>
              <li>Log in normally - all data intact</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </div>
  );
}