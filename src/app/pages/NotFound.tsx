import { useNavigate } from "react-router";
import { Home } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { motion } from "motion/react";

export function NotFound() {
  const navigate = useNavigate();
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const dc = darkMode;

  return (
    <div className={`${isUrdu ? fontClass : ""} min-h-[60dvh] flex items-center justify-center p-6 transition-colors duration-300 ${dc ? "bg-gray-950" : ""}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-7xl sm:text-9xl font-bold text-blue-600 mb-4">404</h1>
        <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold mb-4 ${dc ? "text-white" : "text-gray-900"}`}>{t("notFound.title")}</h2>
        <p className={`mb-8 text-sm sm:text-base ${dc ? "text-gray-400" : "text-gray-600"}`}>{t("notFound.desc")}</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all mx-auto min-h-[48px] text-sm sm:text-base font-semibold active:bg-blue-800"
        >
          <Home className="w-5 h-5" />
          {t("notFound.home")}
        </motion.button>
      </motion.div>
    </div>
  );
}