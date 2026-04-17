import { useNavigate } from "react-router";
import { Check, ArrowLeft, Sparkles, Zap, Crown } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { toast } from "../lib/toast";

const plans = [
  {
    id: "starter",
    name: "Starter",
    nameUrdu: "اسٹارٹر",
    price: 4999,
    icon: Zap,
    features: [
      "Up to 50 active cases",
      "2 agent seats",
      "Document uploads",
      "Basic analytics",
      "Email support",
    ],
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-500",
  },
  {
    id: "business",
    name: "Business",
    nameUrdu: "بزنس",
    price: 9999,
    icon: Sparkles,
    popular: true,
    features: [
      "Unlimited active cases",
      "10 agent seats",
      "Advanced document center",
      "Payment tracking & approvals",
      "AI chatbot assistant",
      "Priority support",
    ],
    color: "from-blue-500 to-indigo-500",
    bg: "bg-blue-500",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    nameUrdu:"انٹرپرائز",
    price: 24999,
    icon: Crown,
    features: [
      "Everything in Business",
      "Unlimited agents",
      "Master admin dashboard",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 phone support",
    ],
    color: "from-violet-500 to-fuchsia-500",
    bg: "bg-violet-500",
  },
];

export function PricingPage() {
  const navigate = useNavigate();
  const { darkMode, isUrdu } = useTheme();
  const dc = darkMode;

  const handleSubscribe = (planId: string) => {
    toast.info(isUrdu ? "اسٹریپ چیک آؤٹ جلد آ رہا ہے" : "Stripe checkout coming soon — contact support to activate.");
  };

  return (
    <div className={`min-h-screen ${dc ? "bg-gray-950" : "bg-slate-50"}`}>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate(-1)}
          className={`flex items-center gap-2 text-sm font-medium mb-8 ${dc ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
        >
          <ArrowLeft className="w-4 h-4" /> {isUrdu ? "واپس" : "Back"}
        </button>

        <div className="text-center mb-12">
          <h1 className={`text-3xl font-bold mb-3 ${dc ? "text-white" : "text-gray-900"}`}>
            {isUrdu ? "قیمتوں کا تعین" : "Pricing Plans"}
          </h1>
          <p className={`max-w-xl mx-auto ${dc ? "text-gray-400" : "text-gray-500"}`}>
            {isUrdu
              ? "اپنے آفس کے سائز کے مطابق بہترین پلان منتخب کریں۔ 7 دن کی منی بیک گارنٹی۔"
              : "Choose the plan that fits your office size. 7-day money-back guarantee."}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative p-6 rounded-3xl border transition-all hover:shadow-xl ${
                  plan.popular
                    ? `${dc ? "border-blue-500/40 bg-gray-900" : "border-blue-300 bg-white"} shadow-lg`
                    : `${dc ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-white"}`
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500">
                    {isUrdu ? "سب سے مقبول" : "Most Popular"}
                  </span>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.bg} bg-opacity-10`}>
                  <Icon className={`w-6 h-6 ${plan.bg.replace("bg-", "text-")}`} />
                </div>
                <h3 className={`text-xl font-bold mb-1 ${dc ? "text-white" : "text-gray-900"}`}>
                  {isUrdu ? plan.nameUrdu : plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`text-3xl font-bold ${dc ? "text-white" : "text-gray-900"}`}>PKR {plan.price.toLocaleString()}</span>
                  <span className={`text-sm ${dc ? "text-gray-400" : "text-gray-500"}`}>/{isUrdu ? "ماہانہ" : "month"}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dc ? "text-emerald-400" : "text-emerald-600"}`} />
                      <span className={dc ? "text-gray-300" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-transform active:scale-95 text-white bg-gradient-to-r ${plan.color}`}
                >
                  {isUrdu ? "سبسکرائب کریں" : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={`mt-12 text-center text-xs ${dc ? "text-gray-500" : "text-gray-400"}`}>
          {isUrdu
            ? "تمام قیمتیں پاکستانی روپیوں میں ہیں۔ GST الگ سے لاگو ہو سکتا ہے۔"
            : "All prices are in Pakistani Rupees (PKR). GST may apply additionally."}
        </div>
      </div>
    </div>
  );
}
