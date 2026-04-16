CT AS: Senior Product Designer & System Architect for Enterprise CRM Systems.

TASK: Design a FULL-FLEDGED "Operations" page for Emerald Visa CRM (Computer Operator Role). Integrate advanced features (Supabase Storage Uploads, Push Notifications, Document Checklist Review) while maintaining an EXTREMELY SIMPLE UI (Operator has limited education).

TECH & DESIGN SYSTEM (Match Existing package.json):
- Stack: React 18.3.1 + Vite + Tailwind CSS v4
- UI Libraries: shadcn/ui + Radix UI + MUI + Lucide React icons
- Backend Visuals: Supabase Storage (Buckets: 'receipts', 'documents'), Supabase Realtime (Notifications)
- Forms: React Hook Form + Input-OTP
- Notifications: Sonner (Toasts) + Browser Push API visuals
- Theme: Same
- Language: Urdu/English toggle + Roman Urdu support (UI Labels)
- Mobile-responsive (Operator may use tablet)

OPERATOR ROLE DEFINITION (Strict Permissions):
- ✅ CAN SEE: All cases, agents' work, payments, documents, deadlines,,Change case status 
- ✅ CAN DO: Upload receipts (Supabase), Confirm status (Trigger Push Notify), Review Checklists, Log Attendance, Generate Reports
- ❌ CANNOT DO: Edit agent assignments, Approve payments, 
- ✅ MUST REPORT: Daily summary to Admin via WhatsApp/Email

---

## 🌟 ADVANCED FEATURES TO INTEGRATE:

### 1. 📸 RECEIPT PHOTO UPLOAD (Supabase Storage Integration):
- **UI Component:** "📸 Upload Receipt" button within Payment Documentation section.
- **Flow:**
  1. Click Upload → Opens Device Camera/Gallery (Mobile) or File Picker (Desktop).
  2. **Visual Feedback:** Show Supabase Storage progress bar (0% → 100%) with cloud icon ☁️.
  3. **Preview:** Show thumbnail of uploaded receipt with "✅ Uploaded to Bucket: receipts" badge.
  4. **Error State:** If upload fails → Show "❌ Upload Failed" + [🔄 Retry] button.
  5. **Security:** Display "🔒 Encrypted Storage" icon near upload button.
- **Design:** Large touch target, auto-compress visual indicator, success toast "✅ Receipt Saved in Supabase".

### 2. 🔔 PUSH NOTIFICATIONS (Status Confirmation Triggers):
- **UI Component:** Notification Bell Icon (Top Header) + Toast Messages.
- **Trigger:** When Operator clicks [✓ OK] on Status Monitor → Auto-send Push Notification to Admin.
- **Visuals:**
  - **Permission Modal:** First load → "🔔 Allow Notifications?" [Allow] [Later].
  - **Toast Message:** "✅ Status Verified: EMR-001 Medical Confirmed → Admin Notified".
  - **Bell Badge:** Red dot with count of unread notifications.
  - **Notification Dropdown:** List of recent alerts (e.g., "Operator confirmed Payment for Ahmed Khan - 2m ago").
- **Settings:** Toggle in Profile → "Enable Push Notifications" (Default: ON).

### 3. 📄 DOCUMENT CHECKLIST REVIEW (Within Case Folder Card):
- **UI Component:** Expandable Section inside Case Folder Card.
- **Visual:** Small progress bar on card front (e.g., "📄 5/8 Documents").
- **Expand Action:** Click Chevron ↓ → Expands card to show mini-checklist:

☑ Passport (Verified)
☑ CNIC (Verified)
☐ Medical (Pending) ⚠️
☐ Police (Missing) ❌

- **Review Action:** [👁️ Review Documents] button → Opens read-only document gallery (Supabase 'documents' bucket).
- **Flagging:** If missing docs → Show [⚠️ Flag Missing] button → Notifies Admin.

---

## 📋 OPERATIONS PAGE REQUIREMENTS (Updated):

### 1. 📁 CASE FOLDER MANAGER (View All + Checklist):
- **Big Search Bar:** Type name/phone/case ID → instant filter ALL cases.
- **Card View:**

[📁 EMR-001] Ahmed Khan | Agent: Farhan
Stage: 🟡 Medical | Deadline: 24h
Docs: [====--] 5/8 Complete [👁️ Review]
[⚠️ Flag for Admin]

- **Click Case:** Opens read-only Case Detail → Shows full Document Checklist + Supabase File Links.
- **Create Folder:** "➕ New Folder" → Form → Auto-generates EMR-2024-XXX → Assigns Agent.

### 2. 📊 LIVE DASHBOARD (Operator's Home + Notifications):
- **Stats Cards:** Total Cases | Pending | Overdue | Active Agents.
- **Notification Center Widget:**
- "🔔 Recent Alerts": List of status confirmations made by Operator.
- "⚠️ Needs Attention": Overdue cases, unconfirmed payments.
- **Daily Report:** "📤 Send Report" → Auto-compiles data → WhatsApp/Email → Admin.

### 3. ✅ STATUS MONITOR (Read-Only + Push Notify):
- **List View:** Case | Stage | Due | [✓ OK] [⚠️ Flag].
- **Action [✓ OK]:**
- Click → Show Confirmation Modal: "Confirm Status for EMR-001?"
- Click Confirm → **Trigger Push Notification to Admin** → Show Toast "✅ Admin Notified".
- Log: "Verified by Operator [Time]".
- **Action [⚠️ Flag]:** Select Reason → Auto-WhatsApp Admin.

### 4. 📅 APPOINTMENT TRACKER (Auto + Manual):
- **Auto-Generated:** Medical (36h), Protector (8 AM), Payment (24h).
- **Manual Log:** "➕ Log Appointment" → Form → Save.
- **Visual:** Calendar view with colored dots.
- **Completion:** [✅ Done] → Logs time → Notifies Admin.

### 5. 👥 ATTENDANCE MARKER (Compulsory):
- **Grid:** Big buttons for all staff (Present/Late/Absent).
- **Logic:** Click → Auto-log time + location → Update Monthly View.
- **Export:** "📤 Export CSV" → Send to Admin.

### 6. 🏢 OFFICE VISIT LOGGER:
- **Log Visit:** "➕ Log Office Visit" → Form (Client, Purpose, Met With).
- **List:** Today's visits with timestamps.

### 7. 💰 PAYMENT DOCUMENTATION (Supabase Upload):
- **Record Payment:** Form (Client, Amount, Method).
- **Receipt Upload:** "📸 Upload Receipt" → **Supabase Storage Progress Bar** → Preview → Save.
- **List View:** Date | Client | Amount | Method | Agent | [📄 View Receipt].
- **Unconfirmed Widget:** Highlight payments pending Admin approval >2h.

### 8. 📈 REPORT GENERATOR:
- **Generate:** Auto-compiles Cases, Flags, Attendance, Payments, Visits.
- **Preview:** Urdu/English Summary.
- **Send:** WhatsApp | Email | PDF Download.
- **History:** Last 30 days reports stored.

---

## 🎨 DESIGN RULES (Operator-Friendly + Advanced):
- **Simplicity:** Advanced features (Upload/Notify) must feel like "One Click" actions.
- **Visual Feedback:** Every action (Upload, Confirm, Log) → Show Toast + Sound Option.
- **Language:** Urdu labels default (English toggle).
- **Layout:** Card-based lists (No complex tables).
- **Accessibility:** Large buttons (56px+), High Contrast, Icons + Text.
- **Loading States:** Show Skeleton loaders for Supabase data fetching.
- **Error Handling:** Simple Urdu messages (❌ "Internet kharab hai, retry karen").

---

## 🔗 NAVIGATION INTEGRATION:
- **Sidebar:** "Operations" Icon (📊) → Visible to Admin + Operator ONLY.
- **Mobile:** Bottom Nav → "Operations" tab for Operator.
- **Agent View:** Operations menu HIDDEN.

---

## ⚡ ALL INTERACTIONS MUST WORK (Prototype):
✅ Click Upload Receipt → Show File Picker → Progress Bar → Success Toast.
✅ Click [✓ OK] Status → Show Confirm Modal → Trigger Push Notification Visual → Toast.
✅ Click Case Card → Expand Checklist → Show Document Status (Verified/Pending).
✅ Click Notification Bell → Show Dropdown → Mark as Read.
✅ Toggle Urdu/English → All Labels Switch Instantly.
✅ Mobile → All Buttons Thumb-Friendly, Forms Stack Vertically.
✅ Supabase Visuals → Show Cloud Icons, Storage Paths (e.g., /receipts/2024/EMR-001.jpg).

---

## ❌ DO NOT CHANGE:
- Existing Colors (#50C878, #D4AF37).
- Existing Components (shadcn/ui, Radix, MUI).
- Existing Workflow Stages.
- Agent Permissions (Operator remains Read-Only + Flag).

---

## ✅ FINAL CHECKLIST:
□ Receipt Upload with Supabase Progress Bar ✓
□ Push Notification Visuals (Bell, Toast, Permission) ✓
□ Document Checklist Review inside Case Card ✓
□ Case Folder Manager with Checklist Preview ✓
□ Live Dashboard with Notification Widget ✓
□ Status Monitor with Admin Notification Trigger ✓
□ Appointment Tracker (Auto + Manual) ✓
□ Attendance Marker (All Staff) ✓
□ Office Visit Logger ✓
□ Payment Documentation with Receipt Upload ✓
□ Report Generator (WhatsApp/Email/PDF) ✓
□ Ultra-Simple UI (Large Buttons, Urdu Default) ✓
□ Auto-Save + Confirmation Toasts ✓
□ Mobile-Responsive + Thumb-Friendly ✓
□ Role-Based Visibility (Admin/Operator Only) ✓
□ Existing Emerald Green Theme Preserved ✓

## 💡 KISS PRINCIPLE (Advanced):
Operator opens CRM → Sees big buttons → Clicks Upload/Confirm → System handles complex backend (Supabase/Notifications) silently → Shows simple "✅ Done" message. No technical jargon visible to operator. Urdu by default.