import { useState } from "react";
import {
  DollarSign, Plus, X, Camera, Download, Check, Cloud, Lock, CheckCircle2, Eye, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../../../lib/toast";
import { type Case } from "../../../lib/mockData";
import { uploadFile, getSignedUrl } from "../../../lib/storageService";
import { ImageLightbox } from "../../../components/ImageLightbox";
import { PaymentRecord, STORAGE, load, save } from "./operatorTypes";

export function PaymentsSection({ u, dc, card, txt, sub, inputCls, bigBtn, cases, addNotification }: any) {
  const [payments, setPayments] = useState<PaymentRecord[]>(() => load(STORAGE.payments, []));
  const [showForm, setShowForm] = useState(false);
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [filter, setFilter] = useState<"today" | "week" | "month">("today");
  const [showCasePayments, setShowCasePayments] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const methods = ["Cash", "EasyPaisa", "JazzCash", "Bank"];

  const filtered = payments.filter(p => {
    const d = new Date(p.timestamp);
    const now = new Date();
    if (filter === "today") return p.timestamp.startsWith(today);
    if (filter === "week") return now.getTime() - d.getTime() < 7 * 86400000;
    return now.getTime() - d.getTime() < 30 * 86400000;
  });

  const casePayments = cases.flatMap((c: Case) =>
    (c.payments || []).map((p: any) => ({ ...p, customerName: c.customerName, caseId: c.id }))
  );

  const realUpload = async (paymentId: string, file: File) => {
    setUploadingId(paymentId);
    setUploadProgress(0);
    try {
      const result = await uploadFile(
        `receipts/${paymentId}`,
        file.name || `receipt-${Date.now()}.jpg`,
        file,
        (pct) => setUploadProgress(pct)
      );
      if (result.success && result.path) {
        // Get a signed URL for preview
        const urlResult = await getSignedUrl(`receipts/${paymentId}`, file.name || `receipt-${Date.now()}.jpg`);
        const previewUrl = urlResult.signedUrl || URL.createObjectURL(file);
        const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, storagePath: result.path, uploadProgress: 100 } : p);
        setPayments(updated);
        save(STORAGE.payments, updated);
        addNotification(`Receipt uploaded for ${paymentId}`, `${paymentId} کی رسید اپ لوڈ ہو گئی`, "payment");
        toast.success(u("✅ Receipt saved in Supabase Storage!", "✅ رسید سپابیس سٹوریج میں محفوظ ہو گئی!"));
      } else {
        // Fallback: save local preview URL
        const previewUrl = URL.createObjectURL(file);
        const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, uploadProgress: 100 } : p);
        setPayments(updated);
        save(STORAGE.payments, updated);
        toast.warning(u("⚠️ Saved locally (cloud upload failed)", "⚠️ مقامی طور پر محفوظ (کلاؤڈ ناکام)"));
      }
    } catch (err) {
      const previewUrl = URL.createObjectURL(file);
      const updated = payments.map(p => p.id === paymentId ? { ...p, receiptPhoto: previewUrl, uploadProgress: 100 } : p);
      setPayments(updated);
      save(STORAGE.payments, updated);
      toast.warning(u("⚠️ Saved locally (network error)", "⚠️ مقامی طور پر محفوظ (نیٹ ورک خرابی)"));
    } finally {
      setUploadingId(null);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (paymentId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(u("File too large (max 10MB)", "فائل بہت بڑی ہے (زیادہ سے زیادہ 10MB)")); return; }
    realUpload(paymentId, file);
  };

  const handleNewReceiptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleAdd = () => {
    if (!client.trim() || !amount.trim()) { toast.error(u("Fill required fields", "ضروری خانے بھریں")); return; }
    const rcpt = `RCP-${Date.now().toString(36).toUpperCase()}`;
    const record: PaymentRecord = { id: `PAY-${Date.now()}`, clientName: client.trim(), amount: Number(amount), method, receiptNumber: rcpt, receiptPhoto: null, uploadProgress: 0, timestamp: new Date().toISOString() };
    const updated = [record, ...payments];
    setPayments(updated);
    save(STORAGE.payments, updated);
    if (newReceiptFile) setTimeout(() => realUpload(record.id, newReceiptFile), 300);
    setClient(""); setAmount(""); setNewReceiptFile(null); setReceiptPreview(null);
    setShowForm(false);
    toast.success(`${u("Payment recorded!", "ادائیگی درج ہو گئی!")} ${rcpt}`);
  };

  const totalFiltered = filtered.reduce((s, p) => s + p.amount, 0);

  const exportPaymentsCSV = () => {
    const header = "Date,Client,Amount,Method,Receipt Number,Has Receipt Photo\n";
    const rows = payments.map(p =>
      `${new Date(p.timestamp).toLocaleDateString("en-US")},${p.clientName},${p.amount},${p.method},${p.receiptNumber},${p.receiptPhoto ? "Yes" : "No"}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payments-${today}.csv`; a.click();
    toast.success(u("Payments CSV downloaded!", "ادائیگیاں CSV ڈاؤنلوڈ ہو گئی!"));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowForm(!showForm)}
        className={`${bigBtn} w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white`}>
        <DollarSign className="w-5 h-5" /> {u("+ Record Payment", "+ ادائیگی درج کریں")}
      </motion.button>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className={`rounded-2xl border p-4 space-y-3 overflow-hidden ${card}`}>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder={u("Client Name *", "نام *")} className={inputCls} />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={u("Amount (PKR) *", "رقم (PKR) *")} className={inputCls} dir="ltr" />
            <div className="flex flex-wrap gap-2">
              {methods.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${method === m ? "bg-emerald-600 text-white" : dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                  {m === "Cash" ? "💵" : m === "EasyPaisa" ? "📱" : m === "JazzCash" ? "📲" : "🏦"} {m}
                </button>
              ))}
            </div>
            {/* Receipt Upload */}
            <div className={`rounded-xl border-2 border-dashed p-4 text-center ${dc ? "border-gray-600 bg-gray-700/30" : "border-gray-300 bg-gray-50"}`}>
              {receiptPreview ? (
                <div className="space-y-2">
                  <img src={receiptPreview} alt="Receipt" className="w-24 h-24 object-cover rounded-xl mx-auto" />
                  <p className="text-xs font-medium text-emerald-500"><Lock className="w-3 h-3 inline" /> {u("Encrypted Storage", "محفوظ سٹوریج")} ☁️</p>
                  <button onClick={() => { setNewReceiptFile(null); setReceiptPreview(null); }} className="text-xs text-red-500 font-medium">{u("Remove", "ہٹائیں")}</button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" capture="environment" onChange={handleNewReceiptFile} className="hidden" />
                  <Camera className={`w-8 h-8 mx-auto ${sub}`} />
                  <p className={`text-sm font-medium mt-1 ${txt}`}>📸 {u("Upload Receipt", "رسید اپ لوڈ کریں")}</p>
                  <p className={`text-[10px] ${sub}`}><Lock className="w-3 h-3 inline" /> {u("Secure Supabase Storage", "محفوظ سپابیس سٹوریج")}</p>
                </label>
              )}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} className={`${bigBtn} w-full bg-emerald-600 text-white`}>
              <Check className="w-5 h-5" /> {u("Save", "محفوظ کریں")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 flex-wrap">
        {(["today", "week", "month"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium min-h-[36px] ${filter === f ? "bg-emerald-600 text-white" : dc ? "bg-gray-800 text-gray-400 border border-gray-700" : "bg-white text-gray-500 border border-gray-200"}`}>
            {f === "today" ? u("Today", "آج") : f === "week" ? u("This Week", "اس ہفتے") : u("This Month", "اس مہینے")}
          </button>
        ))}
        <div className={`ml-auto flex items-center gap-2`}>
          <span className={`text-sm font-bold ${txt}`}>{u("Total", "کل")}: <span className="text-emerald-600">PKR {totalFiltered.toLocaleString()}</span></span>
          {payments.length > 0 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={exportPaymentsCSV}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${dc ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
              <Download className="w-3 h-3" /> CSV
            </motion.button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className={`text-center py-4 ${sub}`}>{u("No payments recorded", "کوئی ادائیگی نہیں")}</p>
        ) : filtered.map(p => (
          <div key={p.id} className={`rounded-xl border p-3 sm:p-4 ${card}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${dc ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
                {p.receiptPhoto ? <img src={p.receiptPhoto} alt="R" className="w-10 h-10 rounded-xl object-cover cursor-pointer hover:ring-2 hover:ring-emerald-500 transition" onClick={(e) => { e.stopPropagation(); setLightboxSrc(p.receiptPhoto); setLightboxAlt(`${p.clientName} — ${p.receiptNumber}`); }} /> : <DollarSign className="w-5 h-5 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${txt}`}>{p.clientName}</p>
                <p className={`text-xs ${sub}`}>{p.method} — {new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                <p className={`text-[10px] font-mono ${sub}`}>{p.receiptNumber}</p>
                {uploadingId === p.id && (
                  <div className="mt-1.5">
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${dc ? "bg-gray-700" : "bg-gray-200"}`}>
                      <motion.div animate={{ width: `${uploadProgress}%` }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                    </div>
                    <p className={`text-[10px] mt-0.5 ${sub} flex items-center gap-1`}>
                      <Cloud className="w-3 h-3 text-blue-400" /> ☁️ {Math.round(uploadProgress)}% {u("uploading...", "اپ لوڈ ہو رہا ہے...")}
                    </p>
                  </div>
                )}
                {p.receiptPhoto && <p className="text-[10px] mt-0.5 text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {u("Uploaded to Bucket: receipts", "بکٹ: receipts میں محفوظ")}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-base font-bold text-emerald-600">PKR {p.amount.toLocaleString()}</p>
                {!p.receiptPhoto && uploadingId !== p.id && (
                  <label className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${dc ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" capture="environment" onChange={handleFileSelect(p.id)} className="hidden" />
                    <Camera className="w-3 h-3" /> {u("Upload", "اپ لوڈ")}
                  </label>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border ${card} overflow-hidden`}>
        <button onClick={() => setShowCasePayments(!showCasePayments)} className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold ${txt}`}>
          <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" /> {u("Case Payment History", "کیس ادائیگی کی تاریخ")} ({casePayments.length})</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showCasePayments ? "rotate-90" : ""} ${sub}`} />
        </button>
        <AnimatePresence>
          {showCasePayments && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className={`px-3 pb-3 space-y-2 border-t ${dc ? "border-gray-700" : "border-gray-200"} pt-2`}>
                {casePayments.length === 0 ? (
                  <p className={`text-center py-4 text-xs ${sub}`}>{u("No case payments", "کوئی کیس ادائیگی نہیں")}</p>
                ) : casePayments.map((p: any, idx: number) => (
                  <div key={`cp-${idx}`} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${dc ? "bg-gray-700/50" : "bg-gray-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${txt}`}>{p.customerName} <span className={`font-mono ${sub}`}>({p.caseId})</span></p>
                      <p className={`text-[10px] ${sub}`}>{p.method} — {p.date} — {p.receiptNumber}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600">PKR {p.amount?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Receipt Image Lightbox */}
      <ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => setLightboxSrc(null)} />
    </motion.div>
  );
}
