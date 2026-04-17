import { AdminSidebar } from "../../components/AdminSidebar";
import { AdminHeader } from "../../components/AdminHeader";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "../../lib/ThemeContext";
import { toast } from "../../lib/toast";
import { Case } from "../../lib/mockData";
import { supabase } from "../../lib/supabase";
import { mapSupabaseCaseToLocal } from "../../lib/caseMappers";
import {
  PassportTracker, PassportTracking, PassportLocation, LOCATIONS,
  getLocationLabel, getLocationIcon
} from "../../lib/passportTracker";
import { AuditLogService } from "../../lib/auditLog";
import { DataSyncService } from "../../lib/dataSync";
import { staggerContainer, staggerItem } from "../../lib/animations";
import { useNavigate } from "react-router";
import { usePortalPrefix } from "../../lib/usePortalPrefix";
import { useUnifiedLayout } from "../../components/UnifiedLayout";
import {
  Search, Plus, X, MapPin, Clock, AlertTriangle, ArrowRight,
  RefreshCw, ChevronDown, Eye, History, Home, Filter,
  BookOpen, Shield, AlertCircle, Check, Send, Undo2, Sparkles, Trash2
} from "lucide-react";

export function AdminPassportTracker() {
  const { darkMode, isUrdu, fontClass, t } = useTheme();
  const navigate = useNavigate();
  const prefix = usePortalPrefix();
  const dc = darkMode;
  const card = dc ? "bg-gray-800" : "bg-white";
  const txt = dc ? "text-white" : "text-gray-900";
  const sub = dc ? "text-gray-400" : "text-gray-600";

  const { insideUnifiedLayout } = useUnifiedLayout();

  const [passports, setPassports] = useState<PassportTracking[]>([]);
  const [filteredPassports, setFilteredPassports] = useState<PassportTracking[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<PassportLocation | "all">("all");
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState<PassportTracking | null>(null);
  const [stats, setStats] = useState(PassportTracker.getStats());

  // Checkout form
  const [checkoutForm, setCheckoutForm] = useState({
    caseId: "",
    toLocation: "medical" as PassportLocation,
    notes: "",
  });

  useEffect(() => {
    loadData();
    // Refresh every 60s for overdue checks
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, locationFilter, passports]);

  const loadData = async () => {
    const { data, error } = await supabase.from('cases').select('*');
    const allCases = error ? [] : (data || []).map((r: any) => mapSupabaseCaseToLocal(r));
    setCases(allCases);
    const checked = PassportTracker.getCheckedOut();
    setPassports(checked);
    setStats(PassportTracker.getStats());
  };

  const applyFilters = () => {
    let filtered = [...passports];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        p => p.customerName.toLowerCase().includes(term) ||
             p.passportNumber.toLowerCase().includes(term) ||
             p.caseId.toLowerCase().includes(term)
      );
    }
    if (locationFilter !== "all") {
      filtered = filtered.filter(p => p.currentLocation === locationFilter);
    }
    setFilteredPassports(filtered);
  };

  const handleCheckout = () => {
    if (!checkoutForm.caseId) {
      toast.error(isUrdu ? "کیس منتخب کریں" : "Please select a case");
      return;
    }
    const caseData = cases.find(c => c.id === checkoutForm.caseId);
    if (!caseData) {
      toast.error(isUrdu ? "کیس نہیں ملا" : "Case not found");
      return;
    }

    const lt = toast.loading(isUrdu ? "پاسپورٹ چیک آؤٹ..." : "Checking out passport...");
    setTimeout(() => {
      PassportTracker.checkOut({
        caseId: caseData.id,
        customerName: caseData.customerName,
        passportNumber: caseData.passport,
        toLocation: checkoutForm.toLocation,
        checkedOutBy: "Admin",
        notes: checkoutForm.notes || undefined,
      });

      AuditLogService.log({
        userId: "admin", userName: "Imran Khan", role: "admin",
        action: "passport_checkout", category: "system",
        description: `Checked out passport ${caseData.passport} (${caseData.customerName}) to ${getLocationLabel(checkoutForm.toLocation)}`,
        metadata: { caseId: caseData.id, passportNumber: caseData.passport, toLocation: checkoutForm.toLocation },
      });
      DataSyncService.markModified(caseData.id, "admin", "Imran Khan", "admin", "passport", `Passport sent to ${getLocationLabel(checkoutForm.toLocation)}`);

      toast.dismiss(lt);
      toast.success(
        isUrdu
          ? `پاسپورٹ ${getLocationLabel(checkoutForm.toLocation, true)} کو بھیجا`
          : `Passport sent to ${getLocationLabel(checkoutForm.toLocation)}`
      );
      setShowCheckoutModal(false);
      setCheckoutForm({ caseId: "", toLocation: "medical", notes: "" });
      loadData();
    }, 800);
  };

  const handleReturn = (passportNumber: string) => {
    const existing = PassportTracker.getByPassportNumber(passportNumber);
    const lt = toast.loading(isUrdu ? "واپسی..." : "Returning to office...");
    setTimeout(() => {
      PassportTracker.returnToOffice(passportNumber, "Admin");

      AuditLogService.log({
        userId: "admin", userName: "Imran Khan", role: "admin",
        action: "passport_returned", category: "system",
        description: `Returned passport ${passportNumber} (${existing?.customerName || "Unknown"}) to office`,
        metadata: { passportNumber, customerName: existing?.customerName, caseId: existing?.caseId },
      });
      if (existing?.caseId) {
        DataSyncService.markModified(existing.caseId, "admin", "Imran Khan", "admin", "passport", "Passport returned to office");
      }

      toast.dismiss(lt);
      toast.success(isUrdu ? "پاسپورٹ واپس آ گیا" : "Passport returned to office");
      loadData();
    }, 600);
  };

  const handleMove = (passportNumber: string, newLocation: PassportLocation) => {
    const existing = PassportTracker.getByPassportNumber(passportNumber);
    if (!existing) return;

    const oldLocation = existing.currentLocation;
    PassportTracker.checkOut({
      caseId: existing.caseId,
      customerName: existing.customerName,
      passportNumber: existing.passportNumber,
      toLocation: newLocation,
      checkedOutBy: "Admin",
    });

    AuditLogService.log({
      userId: "admin", userName: "Imran Khan", role: "admin",
      action: "passport_checkout", category: "system",
      description: `Moved passport ${passportNumber} (${existing.customerName}) from ${getLocationLabel(oldLocation)} to ${getLocationLabel(newLocation)}`,
      metadata: { passportNumber, from: oldLocation, to: newLocation, caseId: existing.caseId },
    });
    DataSyncService.markModified(existing.caseId, "admin", "Imran Khan", "admin", "passport", `Passport moved to ${getLocationLabel(newLocation)}`);

    toast.success(isUrdu ? "جگہ تبدیل" : `Moved to ${getLocationLabel(newLocation)}`);
    loadData();
  };

  /** Seed demo passport data from existing active cases */
  const seedDemoData = () => {
    const activeCases = cases.filter(c => !["completed", "rejected"].includes(c.status) && c.passport);
    if (activeCases.length === 0) {
      toast.error(isUrdu ? "سیڈ کرنے کے لیے کوئی ایکٹو کیس نہیں" : "No active cases to seed from");
      return;
    }

    const locations: PassportLocation[] = ["medical", "vendor", "embassy", "imran_house", "customer"];
    let seeded = 0;

    // Seed up to 5 passports at various locations
    activeCases.slice(0, Math.min(5, activeCases.length)).forEach((c, idx) => {
      const existing = PassportTracker.getByPassportNumber(c.passport);
      if (existing && existing.currentLocation !== "office") return; // skip already checked out

      const loc = locations[idx % locations.length];
      PassportTracker.checkOut({
        caseId: c.id,
        customerName: c.customerName,
        passportNumber: c.passport,
        toLocation: loc,
        checkedOutBy: "Admin (Demo Seed)",
        notes: `Demo: sent for ${getLocationLabel(loc)} processing`,
      });
      seeded++;
    });

    if (seeded > 0) {
      AuditLogService.log({
        userId: "admin", userName: "Imran Khan", role: "admin",
        action: "passport_checkout", category: "system",
        description: `Demo seeded ${seeded} passport(s) to various locations`,
        metadata: { seeded },
      });
      toast.success(isUrdu ? `${seeded} ڈیمو پاسپورٹ سیڈ ہو گئے` : `Seeded ${seeded} demo passport(s)!`);
    } else {
      toast.info(isUrdu ? "تمام پاسپورٹ پہلے سے چیک آؤٹ ہیں" : "All passports already checked out");
    }
    loadData();
  };

  const inputCls = `w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
    dc ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "border-gray-300"
  }`;

  const overduePassports = PassportTracker.getOverdue();

  return (
    <div className={`${isUrdu ? fontClass : ""} ${insideUnifiedLayout ? "" : "flex min-h-screen"} transition-colors duration-300 ${dc ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 to-gray-100"}`}>
      {!insideUnifiedLayout && <AdminSidebar />}
      <div className={`flex-1 min-w-0 ${insideUnifiedLayout ? "" : "pt-14 lg:pt-0"}`}>
        {!insideUnifiedLayout && <AdminHeader />}
        <main className="p-3 sm:p-4 md:p-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
            <div>
              <h1 className={`text-xl md:text-3xl font-bold mb-1 ${txt}`}>
                {isUrdu ? "پاسپورٹ ٹریکر" : "Passport Tracker"}
              </h1>
              <p className={sub}>{isUrdu ? "پاسپورٹس کی موجودہ جگہ اور واپسی" : "Track passport locations and returns"}</p>
            </div>
            <div className="flex gap-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={loadData}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl shadow-sm transition-all ${dc ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-white"}`}
              >
                <RefreshCw className="w-4 h-4" /> {isUrdu ? "تازہ" : "Refresh"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCheckoutModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" /> {isUrdu ? "چیک آؤٹ" : "Check Out"}
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={seedDemoData}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-xl hover:from-indigo-700 hover:to-violet-600 transition-all shadow-lg"
              >
                <Sparkles className="w-4 h-4" /> {isUrdu ? "ڈیمو سیڈ" : "Seed Demo"}
              </motion.button>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: isUrdu ? "کل ٹریک" : "Total Tracked", value: stats.total, icon: BookOpen, color: "text-blue-500", bgColor: dc ? "bg-blue-900/20" : "bg-blue-50" },
              { label: isUrdu ? "چیک آؤٹ" : "Checked Out", value: stats.checkedOut, icon: Send, color: "text-amber-500", bgColor: dc ? "bg-amber-900/20" : "bg-amber-50" },
              { label: isUrdu ? "تاخیر شدہ" : "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-red-500", bgColor: dc ? "bg-red-900/20" : "bg-red-50" },
              { label: isUrdu ? "دفتر میں" : "At Office", value: stats.byLocation.office, icon: Home, color: "text-blue-500", bgColor: dc ? "bg-blue-900/20" : "bg-blue-50" },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div key={idx} variants={staggerItem} whileHover={{ y: -4 }}
                  className={`${card} rounded-2xl shadow-lg p-4 md:p-5 border ${dc ? "border-gray-700" : "border-gray-100"}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <h3 className={`text-2xl font-bold mb-1 ${txt}`}>{stat.value}</h3>
                  <p className={`text-xs ${sub}`}>{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Location Breakdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`${card} rounded-2xl shadow-lg p-4 md:p-5 mb-6 border ${dc ? "border-gray-700" : "border-gray-100"}`}
          >
            <h3 className={`text-sm font-bold mb-3 ${txt}`}>
              {isUrdu ? "مقام کے مطابق" : "By Location"}
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {LOCATIONS.map(loc => {
                const count = stats.byLocation[loc.value] || 0;
                const isActive = locationFilter === loc.value;
                return (
                  <motion.button
                    key={loc.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLocationFilter(isActive ? "all" : loc.value)}
                    className={`p-3 rounded-xl text-center transition-all border ${
                      isActive
                        ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                        : dc
                        ? "border-gray-700 hover:border-gray-600"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <span className="text-2xl block mb-1">{loc.icon}</span>
                    <p className={`text-xs font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>
                      {isUrdu ? loc.labelUrdu : loc.label}
                    </p>
                    <p className={`text-lg font-bold mt-1 ${
                      count > 0 ? (isActive ? "text-blue-500" : dc ? "text-white" : "text-gray-900") : dc ? "text-gray-600" : "text-gray-300"
                    }`}>
                      {count}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Overdue Alert */}
          {overduePassports.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-red-500">
                  {isUrdu ? `${overduePassports.length} تاخیر شدہ پاسپورٹ` : `${overduePassports.length} Overdue Passport(s)`}
                </h3>
              </div>
              <div className="space-y-2">
                {overduePassports.map(p => {
                  const status = PassportTracker.getReturnStatus(p);
                  return (
                    <div key={p.passportNumber} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${dc ? "bg-gray-800/50 hover:bg-gray-800/80" : "bg-white hover:bg-gray-50"}`}
                      onClick={() => navigate(`${prefix}/cases/${p.caseId}`)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getLocationIcon(p.currentLocation)}</span>
                        <div>
                          <p className={`text-sm font-medium ${dc ? "text-white" : "text-gray-900"}`}>
                            {p.customerName} ({p.passportNumber})
                          </p>
                          <p className="text-xs text-red-400">{status.label} | {isUrdu ? getLocationLabel(p.currentLocation, true) : getLocationLabel(p.currentLocation)}</p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); handleReturn(p.passportNumber); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium"
                      >
                        <Undo2 className="w-3 h-3" />
                        {isUrdu ? "واپس" : "Return"}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Search */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`${card} rounded-2xl shadow-lg p-4 mb-6 border ${dc ? "border-gray-700" : "border-gray-100"}`}
          >
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={isUrdu ? "نام، پاسپورٹ نمبر، کیس ID..." : "Search by name, passport, case ID..."}
                  className={`${inputCls} pl-12`}
                />
              </div>
            </div>
          </motion.div>

          {/* Passport List */}
          <motion.div variants={staggerContainer} initial="hidden" animate="visible"
            className={`${card} rounded-2xl shadow-lg border ${dc ? "border-gray-700" : "border-gray-100"} overflow-hidden`}
          >
            {filteredPassports.length === 0 ? (
              <div className="text-center py-12">
                <Shield className={`w-16 h-16 mx-auto mb-4 ${dc ? "text-gray-600" : "text-gray-300"}`} />
                <p className={`text-sm font-medium ${dc ? "text-gray-400" : "text-gray-500"}`}>
                  {passports.length === 0
                    ? (isUrdu ? "کوئی چیک آؤٹ پاسپورٹ نہیں" : "No passports checked out")
                    : (isUrdu ? "کوئی نتیجہ نہیں" : "No results found")
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPassports.map((passport, idx) => {
                  const status = PassportTracker.getReturnStatus(passport);
                  return (
                    <motion.div
                      key={passport.passportNumber}
                      variants={staggerItem}
                      whileHover={{ backgroundColor: dc ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}
                      className="p-4 flex items-center gap-4 cursor-pointer"
                      onClick={() => navigate(`${prefix}/cases/${passport.caseId}`)}
                    >
                      {/* Location icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        status.isOverdue
                          ? "bg-red-500/10 ring-2 ring-red-500/30"
                          : dc ? "bg-gray-700" : "bg-gray-100"
                      }`}>
                        {getLocationIcon(passport.currentLocation)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-sm font-bold ${txt}`}>{passport.customerName}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            status.isOverdue
                              ? "bg-red-500/10 text-red-500"
                              : dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-600"
                          }`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs ${sub}`}>{passport.passportNumber}</span>
                          <span className={`text-xs ${sub}`}>|</span>
                          <span className={`text-xs ${sub}`}>{passport.caseId}</span>
                          <span className={`text-xs ${sub}`}>|</span>
                          <span className={`text-xs font-medium ${dc ? "text-blue-400" : "text-blue-600"}`}>
                            {isUrdu ? getLocationLabel(passport.currentLocation, true) : getLocationLabel(passport.currentLocation)}
                          </span>
                        </div>
                        {passport.notes && (
                          <p className={`text-xs mt-1 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                            {passport.notes}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* Move dropdown */}
                        <div className="relative group">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`p-2 rounded-xl transition-all ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                            title="Move"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </motion.button>
                          <div className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl border z-30 hidden group-hover:block ${
                            dc ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                          }`}>
                            {LOCATIONS.filter(l => l.value !== passport.currentLocation && l.value !== "office").map(loc => (
                              <button
                                key={loc.value}
                                onClick={() => handleMove(passport.passportNumber, loc.value)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-all ${
                                  dc ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-50 text-gray-700"
                                }`}
                              >
                                <span>{loc.icon}</span>
                                {isUrdu ? loc.labelUrdu : loc.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* History */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setSelectedPassport(passport); setShowHistoryModal(true); }}
                          className={`p-2 rounded-xl transition-all ${dc ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                          title="History"
                        >
                          <History className="w-4 h-4" />
                        </motion.button>

                        {/* Return to office */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleReturn(passport.passportNumber)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-xl text-xs font-medium hover:bg-blue-600 transition-colors"
                        >
                          <Home className="w-3.5 h-3.5" />
                          {isUrdu ? "واپس" : "Return"}
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCheckoutModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${dc ? "bg-gray-800" : "bg-white"}`}
            >
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  <span className="font-bold">{isUrdu ? "پاسپورٹ چیک آؤٹ" : "Checkout Passport"}</span>
                </div>
                <button onClick={() => setShowCheckoutModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Case selection */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "کیس منتخب کریں" : "Select Case"} *
                  </label>
                  <select
                    value={checkoutForm.caseId}
                    onChange={e => setCheckoutForm({ ...checkoutForm, caseId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">{isUrdu ? "کیس منتخب..." : "Select a case..."}</option>
                    {cases.filter(c => !["completed", "rejected"].includes(c.status)).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.customerName} ({c.passport})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location selection */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "مقام" : "Send To"} *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {LOCATIONS.filter(l => l.value !== "office").map(loc => (
                      <motion.button
                        key={loc.value}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setCheckoutForm({ ...checkoutForm, toLocation: loc.value })}
                        className={`p-3 rounded-xl text-center border transition-all ${
                          checkoutForm.toLocation === loc.value
                            ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                            : dc
                            ? "border-gray-700 hover:border-gray-600"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl block mb-1">{loc.icon}</span>
                        <span className={`text-[10px] font-medium ${dc ? "text-gray-300" : "text-gray-700"}`}>
                          {isUrdu ? loc.labelUrdu : loc.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${dc ? "text-gray-300" : "text-gray-700"}`}>
                    {isUrdu ? "نوٹس" : "Notes"} ({isUrdu ? "اختیاری" : "optional"})
                  </label>
                  <input
                    value={checkoutForm.notes}
                    onChange={e => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                    placeholder={isUrdu ? "نوٹس..." : "Any notes..."}
                    className={inputCls}
                  />
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCheckout}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Send className="w-4 h-4" />
                  {isUrdu ? "چیک آؤٹ" : "Check Out Passport"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && selectedPassport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${dc ? "bg-gray-800" : "bg-white"}`}
            >
              <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  <div>
                    <span className="font-bold block">{isUrdu ? "تاریخ" : "Movement History"}</span>
                    <span className="text-xs text-white/70">{selectedPassport.passportNumber}</span>
                  </div>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                {selectedPassport.history.length === 0 ? (
                  <p className={`text-center py-8 text-sm ${sub}`}>
                    {isUrdu ? "کوئی تاریخ نہیں" : "No movement history"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {[...selectedPassport.history].reverse().map((movement, idx) => (
                      <motion.div
                        key={movement.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            idx === 0
                              ? "bg-blue-500 text-white"
                              : dc ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"
                          }`}>
                            {getLocationIcon(movement.to)}
                          </div>
                          {idx < selectedPassport.history.length - 1 && (
                            <div className={`w-0.5 h-6 ${dc ? "bg-gray-700" : "bg-gray-200"}`} />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={dc ? "text-gray-400" : "text-gray-500"}>
                              {getLocationIcon(movement.from)} {isUrdu ? getLocationLabel(movement.from, true) : getLocationLabel(movement.from)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-blue-500" />
                            <span className={`font-medium ${dc ? "text-white" : "text-gray-900"}`}>
                              {getLocationIcon(movement.to)} {isUrdu ? getLocationLabel(movement.to, true) : getLocationLabel(movement.to)}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 ${dc ? "text-gray-500" : "text-gray-400"}`}>
                            {new Date(movement.movedAt).toLocaleString()} | by {movement.movedBy}
                          </p>
                          {movement.notes && (
                            <p className={`text-[10px] mt-0.5 italic ${dc ? "text-gray-500" : "text-gray-400"}`}>
                              "{movement.notes}"
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}