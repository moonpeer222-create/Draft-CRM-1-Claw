/**
 * UnifiedHeader — Single top header for ALL portal roles.
 * Mobile-first: compact layout, fullscreen search overlay, thumb-friendly targets.
 * Shows: hamburger (mobile), page title, search, notifications, dark mode, language toggle, profile.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu, Search, Sun, Moon, UserCircle, X, Command,
} from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { useUnifiedLayout } from "./UnifiedLayout";
import { ROLE_INFO, getNavForRole, buildPath } from "../lib/navigationConfig";
import { NotificationBell } from "./NotificationPanel";

export function UnifiedHeader() {
  const { darkMode, toggleDarkMode, isUrdu, toggleLanguage } = useTheme();
  const { role, setMobileSidebarOpen, isMobile: layoutMobile } = useUnifiedLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const dc = darkMode;
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof navItems>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Derive current page title from nav config
  const navItems = getNavForRole(role);
  const currentPath = location.pathname;
  const prefix = role === "master_admin" ? "/master" : `/${role}`;
  const currentItem = navItems.find(item => {
    const full = buildPath(role, item);
    if (full === prefix) return currentPath === prefix || currentPath === prefix + "/";
    return currentPath.startsWith(full);
  });
  const pageTitle = currentItem
    ? (isUrdu ? currentItem.labelUrdu : currentItem.label)
    : (isUrdu ? "ڈیش بورڈ" : "Dashboard");

  const roleInfo = ROLE_INFO[role];

  // Map unified role to notification role (master_admin/operator use admin notifications)
  const notifRole: "admin" | "agent" | "customer" = role === "agent" ? "agent" : role === "customer" ? "customer" : "admin";

  // Live search filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const matches = navItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.labelUrdu.includes(q) ||
      item.id.includes(q)
    ).slice(0, 6);
    setSearchResults(matches);
  }, [searchQuery]);

  // Quick search navigation
  const handleSearchNav = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      navigate(buildPath(role, searchResults[0]));
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  const handleResultClick = (item: typeof navItems[0]) => {
    navigate(buildPath(role, item));
    setSearchQuery("");
    setSearchOpen(false);
  };

  // Focus search on open
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Close search on Escape key (desktop)
  useEffect(() => {
    if (!searchOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [searchOpen]);

  // Close search on route change
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, [location.pathname]);

  return (
    <>
      <header
        className={`sticky top-0 z-20 border-b transition-colors duration-200 ${
          dc
            ? "bg-gray-950/80 backdrop-blur-2xl border-white/[0.06]"
            : "bg-white/80 backdrop-blur-2xl border-gray-100"
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-5 md:px-6 h-13 sm:h-[60px]">
          {/* Mobile hamburger — large touch target */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMobileSidebarOpen(true)}
            className={`lg:hidden p-2.5 -ml-0.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
              dc ? "hover:bg-white/8 text-gray-400 active:bg-white/12" : "hover:bg-gray-100 text-gray-500 active:bg-gray-200"
            }`}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h2 className={`text-[15px] sm:text-lg font-bold truncate tracking-tight ${
              dc ? "text-white" : "text-gray-900"
            }`}>
              {pageTitle}
            </h2>
          </div>

          {/* Desktop search bar */}
          {!isMobile && (
            <AnimatePresence mode="wait">
              {searchOpen ? (
                <motion.form
                  key="search-open"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSearchNav}
                  className="relative flex items-center gap-2 flex-1 max-w-xs"
                >
                  <div className={`flex items-center gap-2 flex-1 rounded-xl px-3 py-2 ring-1 transition-colors ${
                    dc
                      ? "bg-white/5 text-white ring-white/10 focus-within:ring-emerald-500/40"
                      : "bg-gray-50 text-gray-900 ring-gray-200 focus-within:ring-emerald-500/40"
                  }`}>
                    <Search className="w-4 h-4 shrink-0 text-gray-400" />
                    <input
                      ref={!isMobile ? searchInputRef : undefined}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={isUrdu ? "تلاش..." : "Search pages..."}
                      className="bg-transparent outline-none text-sm w-full placeholder:text-gray-400"
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-300">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className={`p-1.5 rounded-lg ${dc ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Search results dropdown */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={`absolute top-full mt-2 ${isUrdu ? "right-0" : "left-0"} w-full rounded-xl shadow-xl border overflow-hidden ${
                          dc ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"
                        }`}
                      >
                        {searchResults.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleResultClick(item)}
                              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors ${
                                idx === 0
                                  ? dc ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                                  : dc ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <Icon className="w-4 h-4 shrink-0 opacity-60" />
                              <span className="truncate">{isUrdu ? item.labelUrdu : item.label}</span>
                              {idx === 0 && (
                                <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                  dc ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                                }`}>
                                  Enter ↵
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.form>
              ) : (
                <motion.button
                  key="search-closed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSearchOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    dc
                      ? "bg-white/5 text-gray-500 hover:bg-white/8 hover:text-gray-400 ring-1 ring-white/[0.06]"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-500 ring-1 ring-gray-200"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isUrdu ? "تلاش..." : "Search..."}</span>
                  <kbd className={`hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    dc ? "bg-white/8 text-gray-500" : "bg-white text-gray-400"
                  }`}>
                    <Command className="w-2.5 h-2.5" /> K
                  </kbd>
                </motion.button>
              )}
            </AnimatePresence>
          )}

          {/* Mobile search button — opens fullscreen overlay */}
          {isMobile && !searchOpen && (
            <button
              onClick={() => setSearchOpen(true)}
              className={`p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center ${
                dc ? "hover:bg-white/8 text-gray-400 active:bg-white/12" : "hover:bg-gray-100 text-gray-500 active:bg-gray-200"
              }`}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {/* Divider */}
          <div className={`hidden sm:block w-px h-6 ${dc ? "bg-white/[0.06]" : "bg-gray-200"}`} />

          {/* Notification bell */}
          <NotificationBell role={notifRole} compact />

          {/* Dark mode — hidden on mobile (available in sidebar) */}
          {!isMobile && (
            <motion.button
              whileTap={{ scale: 0.85, rotate: 15 }}
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl transition-colors ${
                dc ? "hover:bg-white/8 text-gray-400" : "hover:bg-gray-100 text-gray-500"
              }`}
              aria-label="Toggle dark mode"
            >
              <AnimatePresence mode="wait">
                {dc ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Sun className="w-[18px] h-[18px]" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Moon className="w-[18px] h-[18px]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* Language toggle */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleLanguage}
            className={`p-2 rounded-xl text-xs font-bold transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
              dc ? "hover:bg-white/8 text-gray-400" : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label="Toggle language"
            title={isUrdu ? "English" : "اردو"}
          >
            {isUrdu ? "EN" : (
              <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>اُ</span>
            )}
          </motion.button>

          {/* Profile / role badge */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const profileItem = getNavForRole(role).find(i => i.id === "profile");
              if (profileItem) navigate(buildPath(role, profileItem));
            }}
            className={`flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-colors min-w-[40px] min-h-[40px] ${
              dc ? "hover:bg-white/8" : "hover:bg-gray-50"
            }`}
          >
            <div className={`w-7 h-7 rounded-lg ${roleInfo.bgClass} flex items-center justify-center ring-2 ring-white/20`}>
              <UserCircle className="w-4 h-4 text-white" />
            </div>
            {!isMobile && (
              <span className={`text-xs font-semibold ${dc ? "text-gray-300" : "text-gray-600"}`}>
                {isUrdu ? roleInfo.labelUrdu : roleInfo.label}
              </span>
            )}
          </motion.button>
        </div>
      </header>

      {/* ── Mobile fullscreen search overlay ─────────────────────────── */}
      <AnimatePresence>
        {isMobile && searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`fixed inset-0 z-[60] flex flex-col ${
              dc ? "bg-gray-950" : "bg-white"
            }`}
          >
            {/* Search header */}
            <div className={`flex items-center gap-2 px-3 border-b ${
              dc ? "border-white/[0.06]" : "border-gray-100"
            }`} style={{ paddingTop: "env(safe-area-inset-top, 8px)" }}>
              <div className="flex-1 flex items-center gap-2.5 py-3">
                <Search className={`w-5 h-5 shrink-0 ${dc ? "text-gray-500" : "text-gray-400"}`} />
                <form onSubmit={handleSearchNav} className="flex-1">
                  <input
                    ref={isMobile ? searchInputRef : undefined}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isUrdu ? "صفحات تلاش کریں..." : "Search pages..."}
                    className={`bg-transparent outline-none text-base w-full ${
                      dc ? "text-white placeholder:text-gray-600" : "text-gray-900 placeholder:text-gray-400"
                    }`}
                    autoFocus
                  />
                </form>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={`p-1 ${dc ? "text-gray-500" : "text-gray-400"}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className={`px-3 py-2 text-sm font-medium rounded-lg ${
                  dc ? "text-emerald-400 active:bg-white/5" : "text-emerald-600 active:bg-gray-50"
                }`}
              >
                {isUrdu ? "بند" : "Cancel"}
              </button>
            </div>

            {/* Mobile search results */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {searchQuery.trim() === "" ? (
                <div className={`px-4 py-6 text-center ${dc ? "text-gray-600" : "text-gray-400"}`}>
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{isUrdu ? "صفحہ کا نام ٹائپ کریں" : "Type a page name"}</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className={`px-4 py-10 text-center ${dc ? "text-gray-600" : "text-gray-400"}`}>
                  <p className="text-sm font-medium">{isUrdu ? "کوئی نتیجہ نہیں" : "No results"}</p>
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(item)}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:scale-[0.98] ${
                          idx === 0
                            ? dc ? "bg-emerald-500/8 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                            : dc ? "text-gray-300 active:bg-white/5" : "text-gray-700 active:bg-gray-50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          idx === 0
                            ? dc ? "bg-emerald-500/15" : "bg-emerald-100"
                            : dc ? "bg-white/5" : "bg-gray-100"
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium truncate">
                            {isUrdu ? item.labelUrdu : item.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}