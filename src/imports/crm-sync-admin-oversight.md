Update existing Emerald Visa CRM design to ensure perfect sync between Admin, Agent, and Customer roles with strict Admin oversight.

TECH & DESIGN (Match Existing):
- Stack: React 18 + Vite + Tailwind v4 + shadcn/ui + Radix UI + MUI + Lucide Icons
- Theme same
- Notifications: Use `sonner` for toast alerts
- Components: Use existing shadcn/ui (Table, Badge, Button, Dialog, Input)

CORE REQUIREMENTS (Super Synced & Admin Control):

1. REAL-TIME NOTIFICATION SYSTEM (Admin Central):
   - Notification Bell (Header): Red badge count for every unapproved action
   - Admin Dashboard Widget: "Live Activity Feed" showing real-time entries (Agent added payment, Customer uploaded doc, etc.)
   - Every Agent/Customer action triggers instant Admin notification (Visual toast in prototype)

2. ROLE-BASED PERMISSIONS (Visual Cues):
   - Admin: Full Edit/Delete/Approve access everywhere (Green borders)
   - Agent: Create/View ONLY (Own cases). Payment/Doc fields show "Pending Admin Approval" badge
   - Customer: View/Upload ONLY. Status shows "Submitted for Review"

3. ADMIN OVERSIGHT FEATURES:
   - Approval Queue Page: List of all Agent/Customer entries requiring Admin verification
   - Action Buttons: [Approve] [Reject] [Edit] on every Agent entry
   - Audit Log Table: Timestamp | User | Action | IP Address (Visible to Admin only)
   - Global Search: Admin can search ANY case, payment, or document across all agents

4. SYNC INDICATORS (UI Feedback):
   - "Live Sync" Badge: Green dot indicating data is up-to-date
   - "Last Updated By": Show which user made the last change
   - Conflict Warning: If Admin edits while Agent is viewing, show "Data Updated Elsewhere" modal

5. WORKFLOW INTEGRATION:
   - Agent Adds Payment → Status: "Pending Admin Confirmation" → Admin Notified → Admin Approves → Status: "Verified"
   - Customer Uploads Doc → Status: "Submitted" → Admin Notified → Admin Verifies → Status: "Approved"
   - Agent Changes Case Stage → Admin Notified → Auto-logged in Activity Feed

6. NAVIGATION & ACCESS:
   - Admin Sidebar: All menus unlocked (Users, Payments, Documents, Settings, Logs)
   - Agent Sidebar: Limited menus (My Cases, Tasks, Profile). Payment/Doc menus show lock icon
   - Customer View: WhatsApp-first or Simplified Portal (Track Only)

INTERACTIONS (All Working in Prototype):
✅ Admin clicks notification → Navigates to specific case/action
✅ Agent submits payment → Shows "Sent for Approval" toast → Admin sees request
✅ Admin approves → Status updates instantly across all views
✅ Audit log updates with every click
✅ Mobile-responsive (Stack tables, simplify feeds)
✅ Existing Emerald Green theme preserved exactly

FINAL CHECKLIST:
□ Admin notified on EVERY change ✓
□ Admin can see/write/edit EVERYTHING ✓
□ Agent/Customer actions require Admin approval ✓
□ Real-time Activity Feed visible to Admin ✓
□ Audit Log tracking all entries ✓
□ Visual sync indicators (Live badges, timestamps) ✓
□ Existing shadcn/ui + Tailwind v4 components used ✓
□ No theme changes (#50C878 preserved) ✓
□ All buttons/links working in prototype ✓

KISS PRINCIPLE: Admin sees all, controls all, notified on all. Agents execute tasks, Admin verifies. Clear visual status on every entry.
