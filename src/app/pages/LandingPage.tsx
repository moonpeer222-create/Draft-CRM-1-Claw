import { useNavigate } from "react-router";
import { Shield, Briefcase, User, Sun, Moon, Globe, ArrowRight, Sparkles, Crown, Monitor, Gem } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../lib/toast";
import { useTheme } from "../lib/ThemeContext";
import { staggerContainer, staggerItem, floating } from "../lib/animations";

export function LandingPage() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, toggleLanguage, t, isUrdu, fontClass } = useTheme();

  const roles = [
    {
      id: "master",
      title: isUrdu ? "ماسٹر ایڈمن" : "Master Admin",
      description: isUrdu ? "اعلیٰ انتظامیہ - مکمل سسٹم کنٹرول" : "Executive access — Full system control",
      icon: Crown,
      gradient: "from-violet-600 via-purple-600 to-fuchsia-500",
      iconBg: "bg-violet-500",
      glowColor: "shadow-purple-500/20",
      hoverShadow: "hover:shadow-purple-500/30",
      route: "/master/login",
    },
    {
      id: "admin",
      title: t("portal.admin"),
      description: t("portal.admin.desc"),
      icon: Shield,
      gradient: "from-emerald-600 via-emerald-500 to-teal-400",
      iconBg: "bg-emerald-500",
      glowColor: "shadow-emerald-500/20",
      hoverShadow: "hover:shadow-emerald-500/30",
      route: "/admin/login",
    },
    {
      id: "agent",
      title: t("portal.agent"),
      description: t("portal.agent.desc"),
      icon: Briefcase,
      gradient: "from-blue-600 via-blue-500 to-cyan-400",
      iconBg: "bg-blue-500",
      glowColor: "shadow-blue-500/20",
      hoverShadow: "hover:shadow-blue-500/30",
      route: "/agent/login",
    },
    {
      id: "customer",
      title: t("portal.customer"),
      description: t("portal.customer.desc"),
      icon: User,
      gradient: "from-indigo-600 via-indigo-500 to-violet-400",
      iconBg: "bg-indigo-500",
      glowColor: "shadow-indigo-500/20",
      hoverShadow: "hover:shadow-indigo-500/30",
      route: "/customer/login",
    },
    {
      id: "operator",
      title: isUrdu ? "آپریٹر پورٹل" : "Operator Portal",
      description: isUrdu ? "روزمرہ آفس کام، حاضری، ادائیگی، ملاقاتیں" : "Daily office tasks, attendance, payments",
      icon: Monitor,
      gradient: "from-amber-600 via-orange-500 to-yellow-400",
      iconBg: "bg-orange-500",
      glowColor: "shadow-orange-500/20",
      hoverShadow: "hover:shadow-orange-500/30",
      route: "/operator/login",
    },
  ];

  const handleLanguageToggle = () => {
    toggleLanguage();
    toast.info(`${t("lang.changed")} ${language === "en" ? "اردو" : "English"}`);
  };

  return (
    <div
      className={`${isUrdu ? fontClass : ""} min-h-screen transition-colors duration-500 relative overflow-hidden ${
        darkMode
          ? "bg-gray-950"
          : "bg-gradient-to-br from-slate-50 via-white to-emerald-50/40"
      }`}
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* Animated background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          {...floating}
          className={`absolute top-20 left-10 w-80 h-80 rounded-full blur-[100px] ${
            darkMode ? "bg-emerald-600/10" : "bg-emerald-200/50"
          }`}
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-[100px] ${
            darkMode ? "bg-blue-600/8" : "bg-blue-200/40"
          }`}
        />
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] rounded-full blur-[120px] ${
            darkMode ? "bg-violet-600/5" : "bg-violet-100/30"
          }`}
        />
        {/* Grid pattern overlay */}
        {!darkMode && (
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
        )}
      </div>

      {/* Header Controls */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`absolute top-4 sm:top-6 ${isUrdu ? "left-4 sm:left-6" : "right-4 sm:right-6"} flex gap-2 z-20`}
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleLanguageToggle}
          className={`p-2.5 rounded-xl backdrop-blur-xl shadow-lg transition-all relative ${
            darkMode
              ? "bg-white/8 hover:bg-white/12 border border-white/10 text-gray-300"
              : "bg-white/80 hover:bg-white border border-gray-200/60 text-gray-600"
          }`}
        >
          <Globe className="w-4.5 h-4.5" />
          <span className={`absolute -bottom-0.5 ${isUrdu ? "-left-0.5" : "-right-0.5"} text-[8px] font-bold ${
            darkMode ? "text-emerald-400" : "text-emerald-600"
          }`}>
            {language === "en" ? "EN" : "UR"}
          </span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92, rotate: 180 }}
          onClick={() => {
            toggleDarkMode();
            toast.info(!darkMode ? t("darkEnabled") : t("lightEnabled"));
          }}
          className={`p-2.5 rounded-xl backdrop-blur-xl shadow-lg transition-all ${
            darkMode
              ? "bg-white/8 hover:bg-white/12 border border-white/10"
              : "bg-white/80 hover:bg-white border border-gray-200/60"
          }`}
        >
          <AnimatePresence mode="wait">
            {darkMode ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Sun className="w-4.5 h-4.5 text-yellow-400" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Moon className="w-4.5 h-4.5 text-gray-600" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-20 max-w-5xl relative z-10">
        {/* Logo and Tagline */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
          className="text-center mb-8 sm:mb-16"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
            className="inline-block mb-5 sm:mb-7"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className={`absolute -inset-3 rounded-3xl blur-2xl ${
                  darkMode ? "bg-emerald-500/15" : "bg-emerald-400/25"
                }`}
              />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <Gem className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-1.5 -right-1.5"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 drop-shadow-lg" />
                </motion.div>
              </div>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`text-2xl sm:text-4xl md:text-5xl font-extrabold mb-3 tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}
          >
            {t("app.title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`text-sm sm:text-lg max-w-xl mx-auto ${darkMode ? "text-gray-400" : "text-gray-500"}`}
          >
            {t("app.tagline")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6"
          >
            <button
              id="landing-signup-btn"
              onClick={() => navigate("/signup")}
              className={`px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center gap-2 mx-auto ${
                darkMode 
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20" 
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Join as an Agency
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>

        {/* Role Selection Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-10"
        >
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.id}
                variants={staggerItem}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(role.route)}
                className={`cursor-pointer rounded-2xl overflow-hidden group transition-shadow duration-300 select-none touch-manipulation active:scale-[0.98] ${
                  darkMode
                    ? `bg-white/[0.04] border border-white/[0.06] shadow-xl ${role.hoverShadow} hover:border-white/10 hover:shadow-2xl`
                    : `bg-white border border-gray-100 shadow-md ${role.hoverShadow} hover:border-gray-200/80 hover:shadow-xl`
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Gradient top stripe */}
                <div className={`h-1 bg-gradient-to-r ${role.gradient}`} />

                <div className="p-5 sm:p-6">
                  {/* Icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5.5 h-5.5 text-white" />
                    </div>
                    <motion.div
                      className={`p-1.5 rounded-lg ${darkMode ? "bg-white/5" : "bg-gray-50"}`}
                      whileHover={{ x: isUrdu ? -3 : 3 }}
                    >
                      <ArrowRight className={`w-4 h-4 ${isUrdu ? "rotate-180" : ""} ${darkMode ? "text-gray-500" : "text-gray-400"}`} />
                    </motion.div>
                  </div>

                  {/* Text */}
                  <h3 className={`text-base sm:text-lg font-bold mb-1.5 ${darkMode ? "text-white" : "text-gray-900"}`}>
                    {role.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {role.description}
                  </p>

                  {/* CTA */}
                  <div className={`mt-4 pt-4 border-t ${darkMode ? "border-white/[0.06]" : "border-gray-100"}`}>
                    <span className={`text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      darkMode
                        ? "text-gray-500 group-hover:text-white"
                        : "text-gray-400 group-hover:text-gray-900"
                    }`}>
                      {role.id === "customer" ? t("access.tracking") : t("access.dashboard")}
                      <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isUrdu ? "rotate-180 group-hover:-translate-x-1" : "group-hover:translate-x-1"}`} />
                    </span>
                  </div>
                </div>

                {/* Hover shimmer */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.6 }}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className={`mt-8 text-center text-xs sm:text-sm space-y-1 ${darkMode ? "text-gray-600" : "text-gray-400"}`}
        >
          <p>{t("contact.address")}</p>
          <p>{t("contact.phone")}</p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <button onClick={() => navigate("/pricing")} className="hover:underline">
              {isUrdu ? "قیمتیں" : "Pricing"}
            </button>
            <span>•</span>
            <button onClick={() => navigate("/terms")} className="hover:underline">
              {isUrdu ? "شرائط" : "Terms"}
            </button>
            <span>•</span>
            <button onClick={() => navigate("/privacy")} className="hover:underline">
              {isUrdu ? "رازداری" : "Privacy"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}