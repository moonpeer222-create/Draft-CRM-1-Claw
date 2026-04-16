Add "Daily Data Backup" automation to existing Emerald Visa CRM WITHOUT changing existing design/theme.

TECH STACK (Match package.json):
- React 18.3.1 + Vite + Tailwind v4
- shadcn/ui + Radix UI + MUI + Lucide Icons
- Supabase (Database) + Brevo API (Email)
- Sonner notifications + React Hook Form

BACKUP FEATURES TO ADD:

1. ⚙️ BACKUP SETTINGS (Admin Only):
   - Toggle: Enable/Disable Daily Backup
   - Time Selector: "Send backup at [02:00 AM]"
   - Backup Format: JSON | CSV | PDF | Excel
   - Delivery Method: Email (Brevo) | WhatsApp | Download
   - Recipient Emails: Admin + Optional additional emails
   - Encryption: Password-protect backup files (optional)

2. 📦 BACKUP CONTENT (Selectable):
   - ☐ All Cases Data
   - ☐ Payment Records
   - ☐ Document List (metadata, not files)
   - ☐ User/Agent Activity Log
   - ☐ Vendor Transactions
   - ☐ Medical Results
   - ☐ Protector Records
   - ☐ Attendance Logs
   - Select All button

3. 📧 AUTOMATED EMAIL TEMPLATE (Brevo Integration):
   - Subject: "Emerald Visa CRM - Daily Backup [Date]"
   - Body: 
     * Total Cases: [count]
     * New Cases Today: [count]
     * Payments Received: [amount]
     * Backup File: [attachment]
     * Generated: [timestamp]
   - Send via Brevo API (configured in Settings)

4. 📊 BACKUP DASHBOARD WIDGET (Admin):
   - Last Backup: [Date/Time] + Status (✓ Success | ❌ Failed)
   - Next Backup: [Countdown timer]
   - Backup History: Last 7 days log (Date | Size | Status | Download)
   - "Send Backup Now" button (manual trigger)
   - Storage Used: [MB/GB] of backup files

5. 🔔 BACKUP NOTIFICATIONS:
   - Success: "Daily backup completed ✓ [2.3 MB]"
   - Failed: "Backup failed ❌ [Retry] [Contact Support]"
   - Storage Warning: "Backup storage 80% full - Clean old backups"
   - Email Confirmation: "Backup sent to admin@emeraldvisa.com"

6. 📁 BACKUP HISTORY & RESTORE:
   - Table: Date | Time | Size | Format | Status | Actions
   - Actions: [Download] [View] [Restore] [Delete]
   - Filter: Last 7 days | 30 days | All
   - Search: By date range
   - Auto-delete: Backups older than 90 days (toggle)

7. 🔐 SECURITY FEATURES:
   - Backup encryption (AES-256)
   - Password protection for downloads
   - Access log: Who downloaded/restored backup
   - Two-factor confirmation for restore
   - Secure cloud storage (Supabase Storage)

8. 📱 MOBILE OPTIMIZED:
   - Backup status widget on Admin mobile dashboard
   - Push notification when backup completes
   - Download backup file on mobile
   - Simplified backup settings (collapsible)

ALL INTERACTIONS MUST WORK (Prototype):
✅ Admin enables daily backup → Shows confirmation toast
✅ Select backup time → Saves → Shows next scheduled time
✅ Click "Send Backup Now" → Shows progress → Success notification
✅ View backup history → Click download → File downloads
✅ Click restore → Shows confirmation modal → Restores data
✅ Failed backup → Shows error + retry button
✅ Email notification preview → Shows Brevo template
✅ Mobile: Backup status visible + downloadable
✅ Existing Emerald Green #50C878 theme preserved

PAGES TO UPDATE (Minimal Changes):
1. Admin Dashboard → Add "Daily Backup" widget
2. Settings Page → Add "Backup Configuration" section
3. New Page: "Backup History" (Admin only)
4. Notifications → Add backup success/failure alerts

DO NOT CHANGE:
❌ Existing colors (#50C878, #D4AF37)
❌ Existing layout structure
❌ Existing shadcn/ui + Radix components
❌ Agent/Customer views (Backup is Admin-only)
❌ Existing 12-stage workflow

FINAL CHECKLIST:
□ Daily backup scheduling (time selector) ✓
□ Backup content selection (checkboxes) ✓
□ Brevo email integration for delivery ✓
□ Backup history with download/restore ✓
□ Success/failure notifications ✓
□ Storage usage indicator ✓
□ Encryption + password protection ✓
□ Manual "Send Backup Now" button ✓
□ Auto-delete old backups (90 days) ✓
□ Mobile-responsive backup widget ✓
□ Admin-only access (role-based) ✓
□ All buttons working in prototype ✓
□ Existing theme preserved ✓

KISS PRINCIPLE:
Admin sets backup time once → System auto-sends backup daily via email → Admin can download/restore anytime → All tracked in backup history. Zero manual work, full data security.