import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import { LayoutDashboard, FileText, CreditCard, Bell } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";

interface MobileBottomNavProps {
  role: "customer";
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const { insideUnifiedLayout } = useUnifiedLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, isUrdu } = useTheme();

  if (insideUnifiedLayout) return null;

  const getNavItems = () => {
    return [
      { path: "/customer", icon: LayoutDashboard, label: isUrdu ? "ہوم" : "Home" },
      { path: "/customer/documents", icon: FileText, label: isUrdu ? "دستاویز" : "Docs" },
      { path: "/customer/payments", icon: CreditCard, label: isUrdu ? "ادائیگی" : "Pay" },
      { path: "/customer/notifications", icon: Bell, label: isUrdu ? "اطلاعات" : "Alerts" },
    ];
  };

  const navItems = getNavItems();

  const isActive = (path: string) => {
    if (path === `/${role}`) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t backdrop-blur-xl ${
        darkMode
          ? "bg-gray-900/98 border-gray-800"
          : "bg-white/98 border-gray-200"
      }`}
      style={{ 
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <motion.button
              key={item.path}
              whileTap={{ scale: 0.85 }}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-2xl min-w-[60px] min-h-[52px] transition-all duration-200 touch-manipulation ${
                active
                  ? darkMode
                    ? "text-blue-400"
                    : "text-blue-600"
                  : darkMode
                  ? "text-gray-500 active:text-gray-300"
                  : "text-gray-500 active:text-gray-700"
              }`}
            >
              {/* Active background pill */}
              {active && (
                <motion.div
                  layoutId={`${role}-bottom-nav-bg`}
                  className={`absolute inset-0 rounded-2xl ${
                    darkMode ? "bg-blue-500/12" : "bg-blue-50"
                  }`}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Icon className={`relative z-10 w-[22px] h-[22px] ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className={`relative z-10 text-[10px] leading-tight text-center ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <motion.div
                  layoutId={`${role}-bottom-nav-dot`}
                  className={`absolute -top-0.5 w-5 h-0.5 rounded-full ${
                    darkMode ? "bg-blue-400" : "bg-blue-600"
                  }`}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}