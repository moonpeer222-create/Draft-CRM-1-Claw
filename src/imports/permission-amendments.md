BRAND (KEEP EXACTLY):

NEW ammendments (Permission-Based):

1. ADMIN PORTAL EXCLUSIVE (Hide from Agents):
   - Passport Tracker Page:
     * Table: Client Name | Passport # | Current Location (Office | Imran's House | Medical | Vendor | Embassy) | Days at Location | Action
     * Auto-alert: Red highlight if passport at location >48 hours
     * Map View: Visual pins for passport locations
   - Documents Section (Full Access):
     * View/Upload/Verify/Delete all documents
     * Scan quality check + Owner approval workflow
   - Payment History (Full View):
     * Complete transaction log for all cases
     * Export to Excel/PDF button
     * Approve/Reject Agent payment entries

2. AGENT PORTAL RESTRICTIONS (Update Existing):
   - Passport Tracker: HIDDEN (remove from navigation)
   - Documents Section: HIDDEN (remove from navigation)
   - Payment Section:
     * SHOW: "Add Payment" button (Record new payment)
     * HIDE: "Payment History" list/table
     * ADD: "Request Payment History" button → Sends notification to Admin
     * ADD: "Request Status" tooltip: "Admin will share history via WhatsApp"

3. ADMIN PAYMENT REQUEST HANDLING:
   - Notification Bell: Shows "Agent Payment Request" badge
   - Click Notification → Opens request details (Agent Name, Case ID, Reason)
   - Actions: "Share via WhatsApp" | "Decline" | "Mark as Sent"
   - Auto-log: Request tracked in activity log

4. WORKFLOW INTEGRATION (Keep Existing 12-Stage):
   - Passport Tracker updates automatically when case moves stages (Medical → Vendor → Embassy)
   - Document section locked for agents, open for admin
   - Payment entry by agent requires Admin approval before showing in history

ALL PROTOTYPE INTERACTIONS MUST WORK:
✅ Admin Navigation: Shows Passport Tracker + Documents + Payment History
✅ Agent Navigation: Hides Passport Tracker + Documents + Payment History
✅ Agent "Add Payment": Opens form → Submits → Shows "Pending Admin Approval"
✅ Agent "Request History": Clicks → Sends notification to Admin → Toast "Request Sent"
✅ Admin "View Requests": Clicks bell → Sees request → Clicks "Share via WhatsApp" → Opens wa.me link
✅ Passport Location: Click dropdown → Change location → Updates tracker
✅ All buttons: Hover/Click states with visual feedback
✅ No broken links or missing pages
✅ Existing Emerald Green theme preserved exactly

PAGES TO UPDATE (Minimal Changes):
1. Admin Dashboard → Add "Passport Tracker" widget + "Payment Requests" notification
2. Agent Dashboard → Remove Passport/Documents links, Update Payment section
3. Case Detail → Admin sees Documents tab, Agent sees "Documents Locked" message
4. Payment Page → Agent sees "Add Only", Admin sees "Add + History + Approve"

TECH COMPATIBILITY:
- Use existing shadcn/ui components (Table, Dialog, Button, Input, Select)
- Use existing Radix UI primitives (Dropdown, Tooltip)
- Use existing MUI icons for status indicators
- Maintain as requirements
- Keep existing navigation structure (only hide/show items based on role)

FINAL CHECKLIST:
□ Passport Tracker visible ONLY to Admin ✓
□ Documents section visible ONLY to Admin ✓
□ Agent can Add Payment but NOT view history ✓
□ Agent can Request History from Admin ✓
□ Admin receives Payment Request notifications ✓
□ All buttons working in prototype mode ✓
□ No theme changes (#50C878 preserved) ✓
□ No layout breaks (responsive maintained) ✓
□ Existing 12-stage workflow intact ✓
□ Contact: 03186986259 visible ✓

KISS PRINCIPLE: Admin sees all control panels. Agent sees only task execution. No confusion, clear permissions, all interactions working.