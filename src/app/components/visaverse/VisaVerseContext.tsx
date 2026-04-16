import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface VisaVerseFeatures {
  aiPredictor: boolean;
  journeyMap: boolean;
  arScanner: boolean;
  voiceAssistant: boolean;
  emojiTracker: boolean;
  trustTrail: boolean;
  videoGenerator: boolean;
  agentLeaderboard: boolean;
  dynamicTheme: boolean;
  chatbot: boolean;
}

interface VisaVerseContextType {
  features: VisaVerseFeatures;
  toggleFeature: (key: keyof VisaVerseFeatures) => void;
  classicMode: boolean;
  toggleClassicMode: () => void;
  xp: number;
  addXP: (amount: number) => void;
  badges: string[];
  addBadge: (badge: string) => void;
  satisfaction: number[];
  addSatisfaction: (rating: number) => void;
}

const defaultFeatures: VisaVerseFeatures = {
  aiPredictor: true,
  journeyMap: true,
  arScanner: true,
  voiceAssistant: true,
  emojiTracker: true,
  trustTrail: true,
  videoGenerator: true,
  agentLeaderboard: true,
  dynamicTheme: true,
  chatbot: true,
};

const VisaVerseContext = createContext<VisaVerseContextType>({
  features: defaultFeatures,
  toggleFeature: () => {},
  classicMode: false,
  toggleClassicMode: () => {},
  xp: 0,
  addXP: () => {},
  badges: [],
  addBadge: () => {},
  satisfaction: [],
  addSatisfaction: () => {},
});

export function useVisaVerse() {
  return useContext(VisaVerseContext);
}

export function VisaVerseProvider({ children }: { children: ReactNode }) {
  const [classicMode, setClassicMode] = useState(() => {
    try { return localStorage.getItem("visaverse_classic") === "true"; } catch { return false; }
  });

  const [features, setFeatures] = useState<VisaVerseFeatures>(() => {
    try {
      const saved = localStorage.getItem("visaverse_features");
      return saved ? { ...defaultFeatures, ...JSON.parse(saved) } : defaultFeatures;
    } catch { return defaultFeatures; }
  });

  const [xp, setXP] = useState(() => {
    try { return parseInt(localStorage.getItem("visaverse_xp") || "0"); } catch { return 0; }
  });

  const [badges, setBadges] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("visaverse_badges") || "[]"); } catch { return []; }
  });

  const [satisfaction, setSatisfaction] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("visaverse_satisfaction") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("visaverse_features", JSON.stringify(features));
  }, [features]);

  useEffect(() => {
    localStorage.setItem("visaverse_classic", String(classicMode));
  }, [classicMode]);

  useEffect(() => {
    localStorage.setItem("visaverse_xp", String(xp));
  }, [xp]);

  useEffect(() => {
    localStorage.setItem("visaverse_badges", JSON.stringify(badges));
  }, [badges]);

  useEffect(() => {
    localStorage.setItem("visaverse_satisfaction", JSON.stringify(satisfaction));
  }, [satisfaction]);

  const toggleFeature = (key: keyof VisaVerseFeatures) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleClassicMode = () => setClassicMode(prev => !prev);

  const addXP = (amount: number) => setXP(prev => prev + amount);

  const addBadge = (badge: string) => {
    setBadges(prev => prev.includes(badge) ? prev : [...prev, badge]);
  };

  const addSatisfaction = (rating: number) => {
    setSatisfaction(prev => [...prev.slice(-99), rating]);
  };

  return (
    <VisaVerseContext.Provider value={{
      features, toggleFeature, classicMode, toggleClassicMode,
      xp, addXP, badges, addBadge, satisfaction, addSatisfaction,
    }}>
      {children}
    </VisaVerseContext.Provider>
  );
}
