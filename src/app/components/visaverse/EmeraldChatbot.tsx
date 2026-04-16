import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Sparkles, ArrowRight } from "lucide-react";
import { useVisaVerse } from "./VisaVerseContext";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  avatar?: string;
}

const QUICK_ACTIONS = [
  { label: "Start Case", labelUrdu: "کیس شروع کریں", icon: "🚀" },
  { label: "Track Status", labelUrdu: "اسٹیٹس ٹریک", icon: "📍" },
  { label: "Talk to Human", labelUrdu: "انسان سے بات", icon: "👤" },
];

const BOT_RESPONSES: Record<string, { en: string; ur: string }> = {
  hello: { en: "Assalam o Alaikum! 👋 I'm Emerald Bot. How can I help you today?", ur: "السلام علیکم! 👋 میں ایمرالڈ بوٹ ہوں۔ بولیں، کیا مدد کروں؟" },
  start: { en: "Ready to start your visa journey? 🚀 You'll need: 1. Passport copy 2. CNIC 3. Photos. Shall I guide you through?", ur: "ویزا کا سفر شروع کرنے کے لیے تیار ہیں؟ 🚀 آپ کو ضرورت ہوگی: 1. پاسپورٹ کاپی 2. شناختی کارڈ 3. تصاویر" },
  status: { en: "Let me check your case status... 📋 Your case is progressing well! Current stage: Document Collection. Next: Selection Call.", ur: "آپ کے کیس کا اسٹیٹس چیک کر رہا ہوں... 📋 آپ کا کیس اچھی طرح آگے بڑھ رہا ہے!" },
  human: { en: "I'll connect you with an agent right away! 👤 You can also call: 03186986259. Avg response time: 2 min.", ur: "میں آپ کو فوری طور پر ایجنٹ سے ملواتا ہوں! 👤 آپ کال بھی کر سکتے ہیں: 03186986259" },
  payment: { en: "Payment info: You can pay via EasyPaisa, JazzCash, Bank Transfer, or Cash at office. Receipt will be generated automatically! 💰", ur: "ادائیگی: ایزی پیسہ، جاز کیش، بینک ٹرانسفر، یا آفس میں نقد۔ رسید خود بخود بن جائے گی! 💰" },
  medical: { en: "Medical examination is done at GAMCA approved centers. We'll schedule it for you and send the token via WhatsApp! 🏥", ur: "میڈیکل گامکا سینٹرز میں ہوتا ہے۔ ہم آپ کے لیے شیڈول کریں گے اور واٹس ایپ پر ٹوکن بھیجیں گے! 🏥" },
  default: { en: "I understand! Let me help you with that. Could you tell me more about what you need? You can also try our quick actions below! 😊", ur: "میں سمجھ گیا! مجھے بتائیں آپ کو کیا چاہیے؟ نیچے کوئیک ایکشنز بھی آزمائیں! 😊" },
};

function detectLanguage(text: string): "en" | "ur" {
  const urduRegex = /[\u0600-\u06FF]/;
  return urduRegex.test(text) ? "ur" : "en";
}

function getBotResponse(input: string): string {
  const lang = detectLanguage(input);
  const lower = input.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("سلام") || lower.includes("ہیلو"))
    return BOT_RESPONSES.hello[lang];
  if (lower.includes("start") || lower.includes("begin") || lower.includes("شروع"))
    return BOT_RESPONSES.start[lang];
  if (lower.includes("status") || lower.includes("track") || lower.includes("اسٹیٹس"))
    return BOT_RESPONSES.status[lang];
  if (lower.includes("human") || lower.includes("agent") || lower.includes("call") || lower.includes("انسان"))
    return BOT_RESPONSES.human[lang];
  if (lower.includes("pay") || lower.includes("ادائیگی") || lower.includes("پیسے"))
    return BOT_RESPONSES.payment[lang];
  if (lower.includes("medical") || lower.includes("میڈیکل") || lower.includes("doctor"))
    return BOT_RESPONSES.medical[lang];

  return BOT_RESPONSES.default[lang];
}

export function EmeraldChatbot() {
  const { features, classicMode, addXP } = useVisaVerse();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, text: "Assalamualikum! 👋 Ready to start your visa journey? 🚀", isBot: true, avatar: "wave" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [botAnimation, setBotAnimation] = useState<"wave" | "think" | "celebrate">("wave");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (classicMode || !features.chatbot) return null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;

    const userMsg: Message = { id: Date.now(), text: msg, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setBotAnimation("think");
    addXP(1);

    setTimeout(() => {
      const response = getBotResponse(msg);
      const botMsg: Message = { id: Date.now() + 1, text: response, isBot: true };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
      setBotAnimation(response.includes("🚀") || response.includes("✅") ? "celebrate" : "wave");
    }, 1000 + Math.random() * 1000);
  };

  const handleQuickAction = (label: string) => {
    handleSend(label);
  };

  // Bot avatar animation
  const avatarEmoji = botAnimation === "wave" ? "👋" : botAnimation === "think" ? "🤔" : "🎉";

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 left-4 z-[150] w-14 h-14 rounded-full
            bg-gradient-to-br from-emerald-500 to-teal-600 text-white
            shadow-lg shadow-emerald-500/30 flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
          {/* Notification dot */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
            1
          </span>
        </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed z-[150]
              inset-2 sm:inset-auto sm:bottom-6 sm:left-4
              sm:w-[380px] sm:h-[520px]
              bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
              border border-gray-200 dark:border-gray-700
              flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-2xl">
              <motion.div
                animate={botAnimation === "wave" ? { rotate: [0, 15, -15, 0] } : botAnimation === "think" ? { y: [0, -3, 0] } : { scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-2xl"
              >
                {avatarEmoji}
              </motion.div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Emerald Bot</p>
                <p className="text-xs text-white/80">{isTyping ? "Typing..." : "Online"}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.isBot
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md"
                      : "bg-emerald-500 text-white rounded-br-md"
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-bl-md flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                        className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick actions */}
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.label)}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium
                    bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300
                    border border-emerald-200/50 dark:border-emerald-700/30
                    hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors
                    min-h-[32px] whitespace-nowrap"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm
                    text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500
                    border-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                    min-h-[44px]"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                    ${input.trim()
                      ? "bg-emerald-500 text-white hover:bg-emerald-600"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                    }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-1.5">
                Emerald Visa · 03186986259
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
