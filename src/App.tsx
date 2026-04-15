import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';

function Dashboard() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button onClick={signOut} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Welcome, {profile?.full_name}</h2>
        <p className="text-gray-600 dark:text-gray-400">Organization: {profile?.organizations?.name}</p>
        <p className="text-gray-600 dark:text-gray-400">Role: {profile?.role}</p>
        <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded">
          <p className="text-sm">⚠️ Next Step: Run the SQL Migration in Supabase Dashboard to enable full multi-tenancy.</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
