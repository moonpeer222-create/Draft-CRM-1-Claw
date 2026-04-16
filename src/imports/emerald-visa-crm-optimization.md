Optimize existing Emerald Visa CRM for perfect mobile AND desktop experience WITHOUT removing any features.

TECH STACK (From package.json):
- React 18.3.1 + Vite + Tailwind CSS v4
- shadcn/ui + Radix UI components
- MUI Material + Lucide React icons
- Motion for animations + Sonner for notifications
- React Router 7.13.0

BRAND (KEEP EXACTLY):
As It is 

MOBILE OPTIMIZATION REQUIREMENTS (Critical):

1. LAYOUT ADAPTATIONS:
   - Desktop (1440px): Multi-column dashboards, horizontal timeline, full tables
   - Tablet (768px): 2-column grid, collapsible sidebar, stacked cards
   - Mobile (390px): Single column, bottom navigation, vertical timeline, card-based lists

2. NAVIGATION:
   - Desktop: Left sidebar (expandable) with all menus
   - Mobile: Bottom tab bar (Dashboard | Cases | Tasks | Profile) + Hamburger menu for secondary items
   - All menu items accessible on mobile (no hidden features)

3. CASE TIMELINE (12-Stage Workflow):
   - Desktop: Horizontal stepper with all stages visible
   - Mobile: Vertical stepper (stacked) with collapsible details
   - All stages clickable on both devices

4. TABLES & DATA:
   - Desktop: Full data tables with all columns
   - Mobile: Card view per row (each case = card with all data)
   - Horizontal scroll enabled if needed (with visual indicator)
   - "View All" button for long lists

5. FORMS & INPUTS:
   - Desktop: Multi-column forms
   - Mobile: Single column, full-width inputs
   - All fields accessible (no overflow issues)
   - Touch-friendly: Min 48px height for all inputs/buttons

6. DASHBOARD WIDGETS:
   - Desktop: 4-column stats grid
   - Mobile: 2-column grid (stacked) with swipeable carousel
   - All widgets visible (no removal)

7. DOCUMENT UPLOAD:
   - Desktop: Drag-drop zone + file picker
   - Mobile: Camera button + Gallery picker (large touch targets)
   - Progress bar visible on both

8. NOTIFICATIONS:
   - Desktop: Bell icon with dropdown
   - Mobile: Bell icon + badge count + full-screen notification list
   - All notifications accessible

9. PAYMENT SECTION:
   - Desktop: Full payment history table
   - Mobile: Collapsible list with expand/collapse per transaction
   - "Add Payment" button fixed at bottom (mobile)

10. ADMIN FEATURES (Passport Tracker, Audit Log, Approvals):
    - All accessible on mobile (no desktop-only features)
    - Simplified views but complete data
    - Approve/Reject buttons large enough for touch

11. AGENT FEATURES (Case Management, Attendance, Tasks):
    - Check-in/out buttons full-width on mobile
    - Case list swipeable with actions on swipe
    - All task checkboxes accessible

12. WHATSAPP INTEGRATION:
    - Click-to-chat buttons work on both
    - Pre-filled templates accessible on mobile

ALL FEATURES TO PRESERVE (Nothing Missing):
✅ 12-stage workflow timeline
✅ Role-based access (Admin/Agent/Customer)
✅ Passport tracker (Admin only)
✅ Document checklist with upload
✅ Payment tracking with Admin approval
✅ Delay reason modal (mandatory if overdue)
✅ Medical 36-hour tracking
✅ Protector process (8 AM appointment)
✅ Video statement upload
✅ Attendance check-in/out with geofence
✅ Notification system (all alerts)
✅ Audit log (Admin view)
✅ Vendor management
✅ WhatsApp templates
✅ Session timer (6-hour agent access)
✅ Access code generator (Admin)
✅ Urdu/English toggle
✅ Dark/Light mode

MOBILE-SPECIFIC FIXES:
- Fix text overflow (truncate long names with tooltip)
- Fix button overlap (proper spacing with auto-layout)
- Fix modal dialogs (full-screen on mobile, centered on desktop)
- Fix dropdown menus (bottom sheet on mobile, dropdown on desktop)
- Fix images (lazy load + compressed for mobile data)
- Fix touch targets (min 48x48px for all interactive elements)
- Fix scrolling (smooth scroll with visual indicators)
- Fix keyboard (numeric keypad for phone/OTP inputs)

RESPONSIVE BREAKPOINTS:
- Mobile: 320px - 640px (iPhone SE to iPhone 15 Pro Max)
- Tablet: 641px - 1024px (iPad Mini to iPad Pro)
- Desktop: 1025px+ (Laptop to Large Monitor)

TESTING CHECKLIST (Both Devices):
□ All pages load without horizontal scroll (mobile) ✓
□ All buttons clickable (no overlap) ✓
□ All forms submittable (no hidden fields) ✓
□ All navigation items accessible ✓
□ All modals/dialogs usable ✓
□ All images load properly ✓
□ All notifications visible ✓
□ All data visible (no truncation without expand) ✓
□ Timeline readable (vertical on mobile) ✓
□ Tables converted to cards (mobile) ✓
□ Touch targets 48px minimum ✓
□ Existing Emerald Green theme preserved ✓

KISS PRINCIPLE:
Same features, adapted layout. Desktop = dense information. Mobile = focused, task-oriented. Nothing removed, everything optimized.
