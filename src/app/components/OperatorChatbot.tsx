/**
 * Operator AI Chatbot — floating chatbot (Urdu-only, via StepFun AI)
 * Uses the existing callGeminiAI helper with role="operator"
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Bot, Sparkles, Monitor, Mic, MicOff, Volume2 } from "lucide-react";
import { useTheme } from "../lib/ThemeContext";
import { callGeminiAI, streamQwenAI, isFallbackResponse, type ChatMessage } from "../lib/geminiApi";
import { buildCRMContext, CRM_ACTION_INSTRUCTIONS, parseActions, executeAllActions } from "../lib/crmTools";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  isAI?: boolean;
}

const QUICK_PROMPTS_UR = [
  { label: "تمام کیسز", text: "تمام کیسز کی تفصیلات دکھاؤ" },
  { label: "نیا کیس بناؤ", text: "نیا کیس بنانا ہے" },
  { label: "اسٹیٹس اپڈیٹ", text: "کیس کا اسٹیٹس اپڈیٹ کرو" },
  { label: "ادائیگی ریکارڈ", text: "ادائیگی ریکارڈ کرو" },
  { label: "تاخیر والے", text: "تاخیر والے کیسز دکھاؤ" },
  { label: "رپورٹ", text: "آج کی CRM رپورٹ دکھاؤ" },
  { label: "کیس فلیگ", text: "کیس فلیگ کرنا ہے ایڈمن ریویو کے لیے" },
  { label: "حاضری", text: "حاضری کی رپورٹ بنا دو" },
];

const GREETING = "السلام علیکم! میں ایمرالڈ AI ہوں۔ آفس کا کوئی بھی کام ہو — ڈیٹا انٹری، رپورٹ، حاضری — بس بتائیں! 💎";

export function OperatorChatbot() {
  const { darkMode, isUrdu, fontClass } = useTheme();
  const dc = darkMode;
  const u = (en: string, ur: string) => (isUrdu ? ur : en);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, text: GREETING, isBot: true },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API support
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Text-to-Speech
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u2022\*\n#]+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ur-PK";
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // Speech-to-Text toggle
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ur-PK';
      recognition.maxAlternatives = 3;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        let finalT = '', interimT = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalT += event.results[i][0].transcript;
          else interimT += event.results[i][0].transcript;
        }
        setInput(finalT || interimT);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch { /* no speech support */ }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    const userMsg: Message = { id: Date.now(), text: msg, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const history: ChatMessage[] = messages
      .filter(m => m.id !== 0)
      .map(m => ({ text: m.text, isBot: m.isBot }));
    const crmCtx = (await buildCRMContext(msg)) + "\n" + CRM_ACTION_INSTRUCTIONS;
    const botMsgId = Date.now() + 1;
    setStreamingMsgId(botMsgId);
    setMessages(prev => [...prev, { id: botMsgId, text: "", isBot: true, isAI: true }]);

    const finalize = async (fullText: string) => {
      const { actions, cleanText } = parseActions(fullText);
      let actionResultText = "";
      if (actions.length > 0) {
        const results = await executeAllActions(actions);
        actionResultText = results.map(r =>
          r.success ? `\u2705 ${r.message}` : `\u274c ${r.message}`
        ).join("\n\n");
      }
      const finalText = actionResultText ? `${actionResultText}\n\n${cleanText}` : (cleanText || fullText);
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: finalText, isAI: true } : m));
      setStreamingMsgId(null);
      setIsTyping(false);
    };

    const fallback = async () => {
      try {
        const result = await callGeminiAI(msg, "operator", "ur", history, crmCtx);
        if (result.success && result.response) { finalize(result.response); return; }
      } catch { /* ignore */ }
      setMessages(prev => prev.map(m => m.id === botMsgId
        ? { ...m, text: "معذرت! AI سروس دستیاب نہیں۔ دوبارہ کوشش کریں۔ 🙏", isAI: false }
        : m));
      setStreamingMsgId(null);
      setIsTyping(false);
    };

    try {
      await streamQwenAI(
        msg, "operator", "ur", history, crmCtx,
        (token) => {
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: m.text + token } : m));
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        },
        finalize,
        fallback,
      );
    } catch {
      await fallback();
    }
  }, [input, isTyping, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className={`fixed bottom-20 lg:bottom-6 ${isUrdu ? "left-6" : "right-6"} z-[100] w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-center`}
          >
            <MessageCircle className="w-6 h-6" />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`absolute -top-1 ${isUrdu ? "-left-1" : "-right-1"} w-4 h-4 rounded-full bg-green-400 border-2 border-white`}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`fixed z-[100] rounded-2xl shadow-2xl border overflow-hidden flex flex-col
              inset-2 sm:inset-auto sm:bottom-20 ${isUrdu ? "sm:left-4" : "sm:right-4"} lg:bottom-4
              sm:w-[400px] ${
              dc ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
            } ${isUrdu ? fontClass : ""}`}
            style={{ height: typeof window !== "undefined" && window.innerWidth < 640 ? undefined : "min(75vh, 560px)" }}
            dir={isUrdu ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{u("Emerald AI", "ایمرالڈ AI")}</p>
                  <p className="text-emerald-200 text-[10px]">
                    {isTyping
                      ? u("Streaming...", "جواب آ رہا ہے...")
                      : u("Operator Assistant", "آپریٹر اسسٹنٹ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Qwen AI
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/15 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.isBot
                        ? dc
                          ? "bg-gray-800 text-gray-200 border border-gray-700"
                          : "bg-gray-100 text-gray-800"
                        : "bg-emerald-600 text-white"
                    } ${msg.isBot ? (isUrdu ? "rounded-tr-sm" : "rounded-tl-sm") : (isUrdu ? "rounded-tl-sm" : "rounded-tr-sm")}`}
                  >
                    {msg.isBot && msg.isAI && (
                      <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3" /> StepFun AI
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}{msg.id === streamingMsgId && (
                      <span className="inline-block w-0.5 h-3.5 bg-emerald-500 ml-0.5 animate-pulse align-middle" />
                    )}</p>
                    {msg.isBot && (
                      <button
                        onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                        className={`inline-flex items-center gap-1 mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
                          isSpeaking
                            ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        }`}
                        title={u("Listen", "سنیں")}
                      >
                        <Volume2 className={`w-3 h-3 ${isSpeaking ? 'animate-pulse' : ''}`} />
                        {u("Listen", "سنیں")}
                      </button>
                    )}
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
                  <div className={`px-4 py-3 rounded-2xl ${dc ? "bg-gray-800" : "bg-gray-100"}`}>
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -6, 0] }}
                          transition={{ delay: i * 0.15, duration: 0.6, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-emerald-500"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Quick prompts — shown when few messages */}
            {messages.length <= 2 && !isTyping && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS_UR.map((q, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => handleSend(q.text)}
                    className={`text-[11px] px-2.5 py-1.5 rounded-full border font-medium ${
                      dc
                        ? "bg-gray-800 border-gray-700 text-emerald-400 hover:bg-gray-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {q.label}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className={`px-3 py-2.5 border-t ${dc ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
              {isListening && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {u("Listening... speak now", "سن رہا ہے... بولیں")}
                  </span>
                </div>
              )}
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-1 ${
                dc ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-300"
              }`}>
                {speechSupported && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={toggleListening}
                    className={`p-2 rounded-lg transition-all shrink-0 ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : dc ? "text-gray-400 hover:text-emerald-400" : "text-gray-500 hover:text-emerald-600"
                    }`}
                    title={u("Voice input", "بولیں")}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </motion.button>
                )}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={u("Type or speak...", "لکھیں یا بولیں...")}
                  disabled={isTyping}
                  className={`flex-1 bg-transparent text-sm py-2.5 outline-none min-h-[40px] ${
                    dc ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
                  }`}
                />
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className={`p-2 rounded-lg ${
                    input.trim() && !isTyping
                      ? "bg-emerald-600 text-white"
                      : dc ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"
                  }`}
                >
                  <Send className={`w-4 h-4 ${isUrdu ? "rotate-180" : ""}`} />
                </motion.button>
              </div>
              <p className="text-[9px] text-center text-gray-400 mt-1.5">
                {speechSupported ? u("🎤 Voice + Type", "🎤 آواز + ٹائپ") : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}