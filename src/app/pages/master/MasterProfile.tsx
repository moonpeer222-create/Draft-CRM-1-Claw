import { MasterSidebar } from "../../components/MasterSidebar";
import { MasterHeader } from "../../components/MasterHeader";
import { useTheme } from "../../lib/ThemeContext";
import { motion } from "motion/react";
import { Crown, Mail, Phone, Shield, Calendar, Clock, User } from "lucide-react";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import { useSupabaseAuth } from "../../context/SupabaseAuthContext";

export function MasterProfile() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const { insideUnifiedLayout } = useUnifiedLayout();
  const { profile } = useSupabaseAuth();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <MasterSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <MasterHeader />}
        <main className="p-3 sm:p-4 md:p-6 max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h1 className={`text-2xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
              {isUrdu ? "پروفائل" : "Profile"}
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden ${dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"}`}
          >
            {/* Banner */}
            <div className="h-32 bg-gradient-to-br from-purple-600 to-amber-500 relative">
              <div className="absolute -bottom-10 left-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl border-4 border-white dark:border-gray-900">
                  {(profile?.full_name || "M")[0]}
                </div>
              </div>
            </div>

            <div className="pt-14 px-6 pb-6">
              <div className="flex items-center gap-2 mb-1">
                <h2 className={`text-xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                  {profile?.full_name || "Master Admin"}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                  dc ? "bg-purple-900/30 text-purple-400 border-purple-600" : "bg-purple-100 text-purple-700 border-purple-200"
                }`}>
                  <Crown className="w-3 h-3" /> {isUrdu ? "ماسٹر ایڈمن" : "Master Admin"}
                </span>
              </div>
              <p className={`text-sm mb-6 ${dc ? "text-gray-400" : "text-gray-500"}`}>
                {isUrdu ? "ماسٹر ایڈمن" : "Master Admin"} — Operations
              </p>

              <div className="space-y-4">
                {[
                  { icon: Mail, label: isUrdu ? "ای میل" : "Email", value: profile?.email || "-" },
                  { icon: Phone, label: isUrdu ? "فون" : "Phone", value: "-" },
                  { icon: Shield, label: isUrdu ? "کردار" : "Role", value: isUrdu ? "ماسٹر ایڈمن" : "Master Admin" },
                  { icon: Calendar, label: isUrdu ? "شمولیت" : "Joined", value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-" },
                  { icon: Clock, label: isUrdu ? "آخری لاگ ان" : "Last Login", value: profile?.last_seen ? new Date(profile.last_seen).toLocaleString() : "-" },
                  { icon: User, label: isUrdu ? "حیثیت" : "Status", value: isUrdu ? "فعال" : "Active" },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center gap-3 p-3 rounded-xl ${dc ? "bg-gray-800" : "bg-gray-50"}`}>
                    <item.icon className={`w-5 h-5 ${dc ? "text-purple-400" : "text-purple-600"}`} />
                    <div>
                      <p className={`text-xs ${dc ? "text-gray-500" : "text-gray-400"}`}>{item.label}</p>
                      <p className={`text-sm font-medium ${dc ? "text-white" : "text-gray-900"}`}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
