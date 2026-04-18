import { useNavigate } from "react-router";
import { ArrowLeft, Scale, FileText, Shield } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";

export function TermsOfService() {
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
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dc ? "bg-emerald-900/30" : "bg-emerald-100"}`}>
              <Scale className={`w-7 h-7 ${dc ? "text-emerald-400" : "text-emerald-600"}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>
                {isUrdu ? "سروس کی شرائط" : "Terms of Service"}
              </h1>
              <p className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>
                {isUrdu ? "آخری اپ ڈیٹ: 15 اپریل 2026" : "Last updated: April 15, 2026"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <section className={section}>
              <h2 className={h2}>{isUrdu ? "1. قبولیت" : "1. Acceptance"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ایمرلڈ ٹیک پارٹنر تک رسئی اور استعمال ان شرائط کی پابندی پر مشروط ہے۔ لاگ ان کرکے آپ ان شرائط سے اتفاق کرتے ہیں۔"
                  : "Access to and use of Emerald Tech Partner is conditional upon acceptance of these terms. By logging in, you agree to be bound by them."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "2. اکاؤنٹس اور سیکیورٹی" : "2. Accounts & Security"}</h2>
              <p className={p}>
                {isUrdu
                  ? "صارفین اپنے لاگ ان اسناد کی سیکیورٹی کے ذمہ دار ہیں۔ کسی دوسرے کو اپنے اکاؤنٹ تک رسئی دینے سے پرہیز کریں۔"
                  : "Users are responsible for the security of their login credentials. Do not share account access with others."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "3. ڈیٹا ملکیت" : "3. Data Ownership"}</h2>
              <p className={p}>
                {isUrdu
                  ? "آپ کا کسٹمر ڈیٹا آپ کی ملکیت ہے۔ ہم اسے تیسرے فریقین کے ساتھ شیئر نہیں کرتے سوائے قانونی تقاضوں کے۔"
                  : "Your customer data remains your property. We do not share it with third parties except as required by law."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "4. ادائیگی اور ری فنڈ" : "4. Payments & Refunds"}</h2>
              <p className={p}>
                {isUrdu
                  ? "سبسکرپشن کی ادائیگی وصول ہونے پر فعال ہوتی ہے۔ 7 دن کی منی بیک گارنٹی دستیاب ہے۔"
                  : "Subscriptions activate upon receipt of payment. A 7-day money-back guarantee is available."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "5. ذمہ داری کی حد" : "5. Limitation of Liability"}</h2>
              <p className={p}>
                {isUrdu
                  ? "ہم سافٹ ویئر کے استعمال سے ہونے والے براہ راست نقصانات کے علاوہ کسی بھی نقصان کی ذمہ داری نہیں لیتے۔"
                  : "We are not liable for any indirect damages arising from the use of the software, except for direct losses caused by our gross negligence."}
              </p>
            </section>

            <section className={section}>
              <h2 className={h2}>{isUrdu ? "6. رابطہ" : "6. Contact"}</h2>
              <p className={p}>
                {isUrdu
                  ? "کسی بھی سوال کے لیے براہ کرم support@emeraldconsultancycompany.com پر رابطہ کریں۔"
                  : "For any questions, please contact support@emeraldconsultancycompany.com."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
