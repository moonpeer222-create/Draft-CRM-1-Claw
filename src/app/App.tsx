import { RouterProvider } from "react-router";
import { router } from "./routes.tsx";
import { useEffect } from "react";
import { registerServiceWorker } from "./lib/offlineQueue";
import { SupabaseAuthProvider } from "./context/SupabaseAuthContext";

// CRITICAL: Import emergency fix FIRST to repair any corrupted data
import "./lib/emergencyDataFix";

export default function App() {
  // Register service worker for offline-first support
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <SupabaseAuthProvider>
      <RouterProvider router={router} />
    </SupabaseAuthProvider>
  );
}
