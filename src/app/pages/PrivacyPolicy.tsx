import { useNavigate } from "react-router";
import { ArrowLeft, Lock, Eye, Server, Trash2 } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

export function PrivacyPolicy() {
  const navigate = useNavigate();
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;
  const section = `p-6 rounded-2xl border ${dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} shadow-sm`;
  const h2 = `text-xl font-bold mb-3 ${dc ? "text-white" : "text-gray-900"}`;
  const p = `text-sm leading-7 ${dc ? "text-gray-300" : "text-gray-600"}`;

  return (
    <div className={`min-h-screen ${dc ? "bg-gray-950" : "bg-slate-50"}`}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 text-sm font-medium mb-6 ${dc ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          <ArrowLeft className="w-4 h-4" /> {isUrdu ? "واپس" : "Back"}
        </button>

        <div className={`p-8 rounded-3xl border ${dc ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"} shadow-lg`}>
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dc ? "bg-blue-900/30" : "bg-blue-100"}`}>
              <Lock className={`w-7 h-7 ${dc ? "text-blue-400" : "text-blue-600"}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "رازداری کی پالیسی" : "Privacy Policy"}
              </h1>
              <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>
                {isUrdu ? "آخری اپ ڈیٹ: 15 اپریل 2026" : "Last updated: April 15, 2026"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <section className={section}>
              <h2 className={h2}>{isUrdu ? "1. ہم کن ڈیٹا کا مجموعہ کرتے ہیں" : "1. What We Collect"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ہم صارفین کا نام، ای میل، فون نمبر، اور کسٹمر کیس ڈیٹا اکٹھا کرتے ہیں تاکہ CRM کی سروس فراہم کی جا سکے۔"
                  : "We collect user names, emails, phone numbers, and customer case data necessary to provide the CRM service."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "2. ڈیٹا کا استعمال" : "2. How We Use Data"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ڈیٹا صرف اکاؤنٹ مینجمنٹ، کسٹمر کیس ٹریکنگ، اور سسٹم نوٹیفکیشنز کے لیے استعمال ہوتا ہے۔"
                  : "Data is used solely for account management, customer case tracking, and system notifications."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "3. ڈیٹا کی حفاظت" : "3. Data Security"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ہم صنعتی معیار کی خفیہ کاری (SSL/TLS) اور Supabase کے محفوظ انفراسٹرکچر کا استعمال کرتے ہیں۔"
                  : "We use industry-standard encryption (SSL/TLS) and Supabase's secure infrastructure to protect your data."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "4. کوکیز" : "4. Cookies"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ہم ضروری کوکیز استعمال کرتے ہیں تاکہ آپ کا سیشن محفوظ رہے۔ کوئی تھرڈ پارٹی ٹریکنگ کوکیز نہیں ہیں۔"
                  : "We use essential cookies to maintain your session securely. No third-party tracking cookies are used."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "5. ڈیٹا حذف کرنا" : "5. Data Deletion"}</h2>
              <p className={p}>
                {isUrdu
                  ? "آپ کسی بھی وقت اپنا اکاؤنٹ اور اس سے وابستہ ڈیٹا حذف کرنے کا درخواست دے سکتے ہیں۔"
                  : "You may request deletion of your account and associated data at any time by contacting support."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "6. رابطہ" : "6. Contact"}</h2>
              <p className={p}>
                {isUrdu
                  ? "رازداری سے متعلق سوالات کے لیے support@emeraldconsultancycompany.com پر لکھیں۔"
                  : "For privacy-related inquiries, email support@emeraldconsultancycompany.com."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
