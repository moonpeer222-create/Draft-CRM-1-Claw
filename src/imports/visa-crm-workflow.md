Update Emerald Visa CRM with 12-stage visa processing workflow and mandatory delay tracking.

## WORKFLOW STAGES (With Deadlines):
1. Document Collection (48 hours)
2. Selection Call/Office Appointment
3. Medical Token Grant
4. Check Medical Status
5. Biometric/Saudi Aitmaad (24h after medical)
6. Payment Confirmation (24h after biometric)
7. Original Documents (Same day)
8. Case Submitted to Manager (8 days)
9. Approved
10. Remaining Amount (24 hours)
11. Ticket Booking
12. Complete

## UI REQUIREMENTS:

### Visual Timeline Component:
- Horizontal stepper (desktop) / Vertical (mobile)
- Color-coded: ✓ Green (on-time) | ⚠️ Orange (warning 75%) | ❌ Red (overdue)
- Clickable stages showing deadline details
- Countdown timer for each active stage

### Delay Reason Modal (Mandatory):
- Triggers automatically when deadline exceeded
- Cannot proceed without selecting reason
- Dropdown options: Customer unavailable | Document issue | Medical delay | Embassy delay | Payment pending | Agent follow-up | Other
- Text field for details
- Stored in database for reporting

### Dashboard Widgets:
- "Overdue Cases" list with [Add Delay Reason] button
- "Upcoming Deadlines" (next 24 hours)
- Stage-wise processing time analytics

### Notifications:
- Alert at 75% of deadline (warning)
- Alert at 100% (overdue + delay reason required)
- Daily admin summary of all overdue cases

## DESIGN:
- Keep Emerald Green #50C878 theme
- Use shadcn/ui components (Progress, Badge, Card, Dialog)
- Lucide React icons for status indicators
- Mobile-responsive timeline
- Smooth animations for stage transitions

## PAGES TO UPDATE:
1. Case Detail → Add timeline + deadline tracker + delay section
2. Case List → Add overdue badge + filter
3. Agent Dashboard → Add overdue cases widget
4. Admin Dashboard → Add delay analytics chart

## DATABASE FIELDS:
- current_stage, stage_started_at, stage_deadline_at
- is_overdue, delay_reason, delay_reported_at

## KISS PRINCIPLE:
One glance should show: On Track ⚠️ Warning ❌ Overdue (with reason)