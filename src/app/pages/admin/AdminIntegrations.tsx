import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { AdminMobileMenu } from "../../components/AdminMobileMenu";
import { useTheme } from "../../lib/ThemeContext";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useState } from "react";

export function AdminIntegrations() {
  const { darkMode } = useTheme();
  const { insideUnifiedLayout } = useUnifiedLayout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className={`min-h-screen ${darkMode ? "dark bg-gray-900" : "bg-gray-50"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`transition-all duration-300 ${insideUnifiedLayout ? "" : "lg:ml-64"}`}>
        <AdminHeader />
        <main className="p-6">
          <div className={`rounded-xl border p-8 shadow-sm ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <h2 className="text-xl font-semibold mb-4">Integrations</h2>
            <p className={`${darkMode ? "text-gray-400" : "text-gray-600"}`}>
              API integration settings will appear here.
            </p>
          </div>
        </main>
      </div>
      <AdminMobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}
