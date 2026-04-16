import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Language, t as translate } from "./i18n";
import { pushSettings } from "./syncService";

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
  isUrdu: boolean;
  dir: "ltr" | "rtl";
  fontClass: string;
}

const defaultThemeValue: ThemeContextType = {
  darkMode: false,
  toggleDarkMode: () => {},
  language: "en",
  toggleLanguage: () => {},
  t: (key: string) => translate(key, "en"),
  isUrdu: false,
  dir: "ltr",
  fontClass: "",
};

const ThemeContext = createContext<ThemeContextType>(defaultThemeValue);

// Persist consolidated settings to crm_settings and push to cloud
function persistSettings(darkMode: boolean, language: Language) {
  try {
    const existing = JSON.parse(localStorage.getItem("crm_settings") || "{}");
    const updated = { ...existing, darkMode, language, updatedAt: new Date().toISOString() };
    localStorage.setItem("crm_settings", JSON.stringify(updated));
    pushSettings();
  } catch { /* ignore */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("emerald-dark-mode") === "true";
    } catch {
      return false;
    }
  });

  const [language, setLanguage] = useState<Language>(() => {
    try {
      return (localStorage.getItem("emerald-language") as Language) || "en";
    } catch {
      return "en";
    }
  });

  // Apply dark mode class to document
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("emerald-dark-mode", String(darkMode));
    persistSettings(darkMode, language);
  }, [darkMode]);

  // Apply language direction and font
  useEffect(() => {
    const root = document.documentElement;
    if (language === "ur") {
      root.setAttribute("dir", "rtl");
      root.setAttribute("lang", "ur");
    } else {
      root.setAttribute("dir", "ltr");
      root.setAttribute("lang", "en");
    }
    localStorage.setItem("emerald-language", language);
    persistSettings(darkMode, language);
  }, [language]);

  // Listen for settings restored from cloud sync (cross-device)
  useEffect(() => {
    const handleSettingsRestored = () => {
      try {
        const storedDark = localStorage.getItem("emerald-dark-mode") === "true";
        const storedLang = (localStorage.getItem("emerald-language") as Language) || "en";
        if (storedDark !== darkMode) setDarkMode(storedDark);
        if (storedLang !== language) setLanguage(storedLang);
      } catch { /* ignore */ }
    };
    window.addEventListener("crm-settings-restored", handleSettingsRestored);
    return () => window.removeEventListener("crm-settings-restored", handleSettingsRestored);
  }, [darkMode, language]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  const toggleLanguage = () => setLanguage((prev) => (prev === "en" ? "ur" : "en"));

  const tFn = (key: string) => translate(key, language);
  const isUrdu = language === "ur";
  const dir = isUrdu ? "rtl" as const : "ltr" as const;
  const fontClass = isUrdu
    ? "font-['Jameel_Noori_Nastaleeq_Kasheeda',_'Noto_Nastaliq_Urdu',_serif]"
    : "";

  return (
    <ThemeContext.Provider
      value={{ darkMode, toggleDarkMode, language, toggleLanguage, t: tFn, isUrdu, dir, fontClass }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}