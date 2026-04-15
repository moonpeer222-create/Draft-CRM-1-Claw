import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Documents from './pages/Documents';

function Dashboard() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center space-x-3">
          <Link
            to="/documents"
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            Documents
          </Link>
          <button onClick={signOut} className="px-4 py-2 bg-red-600 text-white rounded">Logout</button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Welcome, {profile?.full_name}</h2>
        <p className="text-gray-600 dark:text-gray-400">Organization: {profile?.organizations?.name}</p>
        <p className="text-gray-600 dark:text-gray-400">Role: {profile?.role}</p>
        <div className="mt-6 p-4 bg-emerald-100 dark:bg-emerald-900 rounded">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            ✅ Multi-tenancy is active. Document upload is ready.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authError } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        {authError && (
          <p className="mt-2 text-red-600 text-sm max-w-md text-center">{authError}</p>
        )}
      </div>
    );
  }
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
      <Route path="/documents" element={
        <ProtectedRoute>
          <Documents />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
