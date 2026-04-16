Add "VisaVerse" - a gamified, AI-powered experience to existing Emerald Visa CRM WITHOUT changing core design/theme.

TECH STACK (Match package.json):
- React 18.3.1 + Vite + Tailwind v4 + shadcn/ui + Radix UI + MUI + Lucide Icons
- Motion for animations + Sonner for notifications

🎮 CRAZY FEATURES TO ADD:

1. 🎯 AI VISA SUCCESS PREDICTOR:
   - Case detail page: "Approval Probability: 87%" (AI-calculated badge)
   - Factors shown: Document completeness ✓ | Payment status ✓ | Medical fit ✓
   - "Improve Chances" button → AI suggests actions: "Upload experience letter +5%"
   - Animated progress ring (Emerald Green gradient)

2. 🗺️ GAMIFIED CLIENT JOURNEY MAP:
   - Replace linear timeline with interactive "Visa Adventure Map"
   - Each stage = game level: 🏁 Start → 📚 Document Quest → 🏥 Medical Boss → 🛂 Visa Final
   - Client avatar progresses visually as stages complete
   - Unlock badges: "Document Master", "Medical Champion", "Visa Hero"
   - Confetti animation on stage completion

3. 📱 AR DOCUMENT SCANNER (Mobile):
   - "Scan with AR" button → Opens camera with overlay guides
   - Auto-detect document edges + highlight missing fields
   - Real-time quality check: "Blurry → Retake" | "Good ✓"
   - Fun feedback: "Perfect scan! +10 XP"

4. 🎙️ VOICE ASSISTANT FOR AGENTS:
   - Floating mic button: "Hey Emerald, what's next for Ahmed Khan?"
   - Voice responses: "Next: Upload medical report. Tap here to start."
   - Voice commands: "Mark medical as fit", "Send payment reminder"
   - Visual waveform animation when listening

5. 💬 EMOJI MOOD TRACKER (Client Feedback):
   - After each stage: "How was your experience?" 😊 😐 😞
   - Auto-log sentiment in case timeline
   - Admin dashboard: "Client Satisfaction: 94% 😊"
   - Low mood alert → Auto-suggest: "Call client to resolve concerns"

6. 🔗 BLOCKCHAIN-STYLE TRUST TRAIL:
   - "Immutable Audit" badge on verified actions
   - Visual chain: Each approval linked cryptographically (UI only)
   - Client view: "Your case is 100% verified ✓" with shield animation
   - Hover: See who approved what + timestamp

7. 🎬 AI-GENERATED PERSONALIZED VIDEOS:
   - "Send Video Update" button → AI creates 15-sec personalized video:
     * Avatar says: "Assalamualikum Ahmed! Your medical is approved. Next: Biometric!"
     * Background: Emerald Visa branding + progress animation
   - Preview before send → Deliver via WhatsApp/email

8. 🏆 AGENT LEADERBOARD & BADGES:
   - Dashboard widget: "Top Agents This Week"
   - Badges earned: "5 Cases Closed 🎯", "100% On-Time ⚡", "Client Favorite ❤️"
   - Animated badge unlock celebration
   - Click badge → See criteria + share on WhatsApp

9. 🌙 DYNAMIC THEME BASED ON CASE STATUS:
   - Case stage changes → Subtle background animation:
     * Medical: Soft blue pulse
     * Visa Approved: Gold confetti burst
     * Overdue: Gentle red warning glow
   - Client sees themed updates in their portal

10. 🤖 CHATBOT WITH PERSONALITY:
    - "Emerald Bot" avatar with animations (wave, think, celebrate)
    - Conversational UI: "Ready to start your visa journey? 🚀"
    - Quick actions: [Start Case] [Track Status] [Talk to Human]
    - Urdu/English auto-detect + switch

🎨 UI/UX REQUIREMENTS:
- Keep existing theme 
- Add gamification elements as overlays (not replacing core UI)
- Animations: Subtle, performant (use Motion library)
- Mobile: AR scanner full-screen, voice button fixed bottom-right
- Accessibility: All gamification optional (toggle "Classic Mode")

🔗 INTEGRATION POINTS:
- AI Predictor: Mock API endpoint (placeholder for future ML)
- AR Scanner: Use device camera + overlay guides (no backend needed for prototype)
- Voice Assistant: Web Speech API mock responses
- Video Generator: Static template + dynamic text (prototype only)
- Blockchain Trail: Visual chain UI only (no actual crypto)

✅ ALL INTERACTIONS MUST WORK (Prototype):
□ Click AI Predictor badge → Shows factors + suggestions
□ Client journey map: Click level → See details + progress
□ AR Scanner button → Opens camera mock with overlay guides
□ Voice mic button → Shows waveform + sample responses
□ Emoji feedback → Logs to timeline + updates satisfaction meter
□ Trust trail badge → Hover shows approval chain animation
□ "Send Video" → Preview AI-generated video mock
□ Agent badge unlock → Celebration animation + share option
□ Case stage change → Background theme animation
□ Chatbot: Type message → Get animated response

📱 MOBILE OPTIMIZATION:
- AR scanner: Full-screen camera view
- Voice button: Fixed bottom-right (thumb zone)
- Journey map: Vertical scrollable levels
- Emoji feedback: Large tap targets
- All gamification toggle-able for performance

⚙️ ADMIN CONTROLS (Settings Page):
- Toggle each VisaVerse feature On/Off
- Customize badge names, animations, thresholds
- Export gamification analytics (engagement, satisfaction)
- "Classic Mode" switch: Disable all gamification for traditional view

🚫 DO NOT CHANGE:
❌ Existing colors 
❌ Core workflow stages 
❌ Existing components
❌ Role-based permissions (Admin/Agent/Customer)
❌ Contact: 03186986259 visible throughout

🎯 FINAL CHECKLIST:
□ AI Visa Success Predictor badge + suggestions ✓
□ Gamified Journey Map with levels + badges ✓
□ AR Document Scanner mock (camera + overlay) ✓
□ Voice Assistant UI with sample responses ✓
□ Emoji Mood Tracker + satisfaction dashboard ✓
□ Blockchain-style Trust Trail visual ✓
□ AI-Generated Video Preview mock ✓
□ Agent Leaderboard + badge unlock animations ✓
□ Dynamic theme animations per case stage ✓
□ Chatbot with personality + Urdu/English ✓
□ All interactions working in prototype ✓
□ Mobile-optimized + toggle "Classic Mode" ✓
□ Existing Emerald Green theme preserved ✓

💡 KISS PRINCIPLE (Even When Crazy):
Gamification enhances, never distracts. Every "crazy" feature has a clear business purpose: build trust, reduce anxiety, increase engagement. Admin can toggle anything off. Core workflow unchanged.