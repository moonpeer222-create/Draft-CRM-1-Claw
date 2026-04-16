import { useLocation } from "react-router";
import { useVisaVerse } from "./VisaVerseContext";
import { VoiceAssistant } from "./VoiceAssistant";

/**
 * VisaVerse global overlay - renders floating widgets (voice assistant only).
 * The AI Chatbot is now handled globally by GlobalAIChatbot in RootLayout,
 * so it's available on ALL portals regardless of VisaVerse mode.
 */
export function VisaVerseOverlay() {
  const { classicMode } = useVisaVerse();
  const location = useLocation();

  if (classicMode) return null;

  const isAgentRoute = location.pathname.startsWith("/agent") && !location.pathname.includes("/login");
  const isCustomerRoute = location.pathname.startsWith("/customer") && !location.pathname.includes("/login");
  const isAdminRoute = location.pathname.startsWith("/admin") && !location.pathname.includes("/login");
  const isProtectedRoute = isAgentRoute || isCustomerRoute || isAdminRoute;

  if (!isProtectedRoute) return null;

  return (
    <>
      {/* Voice Assistant - available on agent routes */}
      {isAgentRoute && <VoiceAssistant />}
    </>
  );
}