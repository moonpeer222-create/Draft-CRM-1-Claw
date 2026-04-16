ACT AS: Senior Product Designer specializing in enterprise CRM systems for visa/immigration consultancies and recruitment agencies.

TASK: Design a comprehensive, production-ready Web CRM + Mobile App for "Emerald Visa Consultancy Service" - a Pakistan-based recruitment agency connecting Pakistani workers with employers in Gulf countries (Saudi Arabia, UAE, Qatar, Kuwait, Oman, Bahrain).

BUSINESS CONTEXT:
- Company: Emerald Visa Consultancy Service
- Nature: Licensed recruitment/visa consultancy facilitating overseas employment for Pakistani workers
- Services: Work Visa Processing, Document Verification & Attestation, Job Placement Assistance, Medical/Biometric Guidance, Ticket & Travel Arrangements, Pre-Departure Orientation, Gulf Employer Recruitment Partnerships
- Location: Office #25 Faisal Shopping Mall, GPO Saddar, 54000, Lahore, Pakistan
- Contact: Phone: 03186986259 | WhatsApp: 03186986259 | Email: info@emeraldvisaconsultancy.com
- Target Users: 
  • Admin/Owner (full system control)
  • Manager (team oversight, reporting)
  • Field Agents (case management, customer interaction)
  • Customers/Pakistani Workers (visa status tracking)
  • Gulf Employer Partners (recruitment portal - future phase)

BRAND & DESIGN SYSTEM:
- Primary Color: Emerald Green #50C878 (trust, growth, Islamic connection)
- Secondary: Gold #D4AF37 (premium, success), White #FFFFFF, Dark Grey #1a1a1a
- Accent Colors: Red #EF4444 (errors/danger), Orange #F59E0B (warnings), Blue #2563EB (info/links), Green #10B981 (success)
- Typography: Inter (English, clean readable), Jameel Noori Nastaleeq (Urdu, web-safe fallback: Noto Nastaliq Urdu)
- Style: Clean, professional, data-dense but scannable, mobile-first responsive
- Modes: Dark/Light toggle with smooth transition
- Language: Urdu/English bilingual toggle with RTL support for Urdu
- Iconography: Custom visa/recruitment icons (passport, visa stamp, airplane, medical cross, document check) + Lucide React icons
- Spacing: 8px base unit (8, 16, 24, 32, 48, 64px)
- Shadows: Subtle elevation for cards (0 1px 3px rgba(0,0,0,0.1))
- Border Radius: 8px for cards, 20px for badges, 4px for inputs

---

## 🔐 ROLE-BASED LOGIN LANDING PAGE (FIRST SCREEN - CRITICAL ENTRY POINT)

### Visual Layout:
- Full-screen hero background: Subtle Gulf skyline gradient (Emerald → Dark Grey)
- Centered card with logo + tagline: "Emerald Visa Consultancy Service" + "Your Gateway to Gulf Opportunities"
- Language Toggle (UR/EN) + Dark/Light mode toggle in top-right corner

### Three Role Selection Cards (Large, Clickable, Animated):

👑 ADMIN PORTAL LOGIN:
- Icon: Shield/Crown (Gold accent)
- Title: "Admin Portal"
- Description: "Full system access: Reports, Team Management, Financials, Settings"
- Visual: Subtle pulse animation on hover
- Button: "Access Admin Dashboard" → Navigates to Admin Login Form

💼 AGENT PORTAL LOGIN:
- Icon: Briefcase/User Group (Emerald accent)
- Title: "Agent Portal"
- Description: "Manage your cases, customers, appointments, attendance"
- Visual: Gentle scale-up on hover
- Button: "Access Agent Dashboard" → Navigates to Agent Login Form

👤 CUSTOMER PORTAL LOGIN:
- Icon: Passport/Person (Blue accent)
- Title: "Customer Portal"
- Description: "Track your visa status, upload documents, make payments"
- Visual: Soft glow on hover
- Button: "Track My Application" → Navigates to Customer Login Form

### Common Login Form Elements (Appear after role selection):
- Phone Number Input: +92 XXX XXXXXXX format with auto-mask
- "Send OTP" Button: Disabled until valid phone format, shows loading spinner on click
- OTP Input: 6-digit fields with auto-advance, paste support, resend OTP link (60s cooldown)
- "Verify & Continue" Button: Primary Emerald Green, full-width
- Helper Text: "New user? Contact your admin for access"
- Security Badge: "🔐 Secure OTP Login | Data Encrypted"

### Prototype Interactions:
- Role card click → Smooth slide-up animation to role-specific login form
- Phone input focus → Show format helper tooltip
- Invalid phone → Shake animation + red border + error message
- OTP verify success → Confetti animation + redirect to role dashboard
- Language toggle → Instant text switch + RTL layout change for Urdu

---

## 👑 ADMIN PORTAL (FULL SYSTEM ACCESS - SUPERUSER)

### Global Admin Header:
- Left: Logo + "Admin Panel" badge (Gold)
- Center: Global Search (cases, customers, agents, transactions) with type-ahead
- Right: 
  • Notifications Bell (badge count, dropdown with mark-all-read)
  • Language Toggle (UR/EN)
  • Dark/Light Mode Toggle
  • Admin Profile Dropdown: Name, Role, Logout, Settings

### Admin Dashboard (Home):
**A. Executive Summary Cards (Clickable → Detailed Reports):**
1. 📊 Total Cases: [1,247] 
   - Sub: +12% this month | Trend arrow up
   - Breakdown: New(87) | Documents(156) | Medical(203) | Visa(412) | Ticket(289) | Completed(100)
   - Click → Cases Analytics Report

2. ⏰ Pending Actions: [342]
   - Sub: Medical(89) | Payments(127) | Documents(78) | Approvals(48)
   - Click → Action Queue with bulk actions

3. 💰 Financial Overview:
   - Revenue This Month: PKR 2.4M | Due Payments: PKR 847K
   - Collection Rate: 74% | Avg. Processing Fee: PKR 45K
   - Click → Financial Reports + Export

4. 👥 Team Performance:
   - Active Agents: 12/15 | Avg. Cases/Agent: 23
   - Top Performer: Agent Farhan (47 cases closed)
   - Click → Agent Performance Dashboard

**B. Quick Actions Bar (Sticky Below Header):**
- + New Case | + New Agent | + Broadcast Notification | + Generate Report | + Schedule Meeting

**C. Live Activity Feed (Real-time Updates):**
- Timeline view: "[2m ago] Agent Ayesha updated case EMR-2024-0892 to Visa Approved"
- "[5m ago] Payment PKR 45,000 received for case EMR-2024-0876 via EasyPaisa"
- "[12m ago] New customer registration: Ahmed Ali (Lahore) - Destination: Saudi Arabia"
- Each item clickable → Relevant case/customer/agent detail

**D. Interactive Charts Section:**
1. Revenue Trend (Line Chart): Last 6 months, clickable segments → Monthly breakdown
2. Case Funnel (Funnel Chart): Inquiry(100%) → Documents(78%) → Medical(62%) → Visa(41%) → Ticket(33%) → Completed(28%)
3. Country Distribution (Donut Chart): Saudi(42%) | UAE(31%) | Qatar(15%) | Kuwait(8%) | Oman(4%)
4. Agent Performance (Horizontal Bar): Cases closed, avg. time, customer rating

**E. Upcoming Deadlines Widget:**
- Table: Case ID | Customer | Deadline | Type | Assigned Agent | Action
- Types: Medical Appointment | Payment Due | Document Expiry | Visa Decision Expected
- Bulk actions: Send Reminder | Reschedule | Escalate

**F. System Health Monitor:**
- API Status: WhatsApp ✅ | SMS ✅ | Payment Gateway ✅ | Storage ✅
- Storage Used: 67/100 GB | Backup: Last 24h ✅
- Alert Banner: "⚠️ 3 agents haven't marked attendance today"

---

### 📈 Advanced Reporting & Analytics Module:

**Report Categories (Sidebar Navigation):**
1. Case Analytics
2. Financial Reports
3. Agent Performance
4. Customer Insights
5. Operational Metrics
6. Compliance & Audit

**Case Analytics Deep Dive:**
- Filters: Date Range | Country | Job Type | Agent | Status
- Visualizations:
  • Processing Time by Country (Box plot: median, quartiles, outliers)
  • Rejection Reasons Pie Chart: Document Issue(34%) | Medical Fail(28%) | Embassy Delay(22%) | Other(16%)
  • Customer Origin Map: Pakistan districts heatmap
  • Case Volume Heatmap: Day of week × Hour of day
- Export: PDF (print-ready) | Excel (raw data) | PNG (presentation) | WhatsApp Summary (auto-formatted)

**Financial Reports:**
- Revenue Breakdown: By Service Type | By Country | By Agent | By Payment Method
- Outstanding Payments: Aging report (0-30 days, 31-60, 61-90, 90+)
- Expense Tracking: Office, Marketing, Agent Commissions, API Costs
- Profit Margin Calculator: Per case, per country, per agent
- Tax Compliance: GST/VAT summary, downloadable for accountant

**Agent Performance Analytics:**
- Leaderboard: Cases Closed | Revenue Generated | Customer Rating | Avg. Processing Time
- Activity Log: Login frequency, cases updated, notifications sent
- Attendance Correlation: Performance vs. attendance consistency
- Training Needs: Auto-flag agents with high rejection rates or slow processing

**Customer Insights:**
- Demographics: Age distribution, education level, prior Gulf experience
- Satisfaction Metrics: Post-completion survey scores, NPS, testimonials
- Retention: Repeat customers, referral sources
- Pain Points: Common support queries, drop-off stages in funnel

**Operational Metrics:**
- SLA Compliance: % cases meeting target processing times
- Bottleneck Analysis: Average wait time at each stage
- Resource Utilization: Agent workload distribution, peak hours
- Automation Impact: Time saved by auto-reminders, template usage

**Compliance & Audit Trail:**
- Data Access Log: Who viewed/edited which case and when
- Document Verification History: Uploaded → Reviewed → Approved/Rejected
- Payment Audit: Transaction IDs, timestamps, verification status
- Export for Regulatory Submission: One-click generate compliance report

---

### 👥 Team & Agent Management Module:

**Agent Directory:**
- Grid/List toggle view
- Agent Card: Photo, Name, Phone, Email, Join Date, Status Badge (Active/On Leave/Inactive)
- Quick Stats: Assigned Cases | Completed This Month | Avg. Rating | Attendance %
- Actions: 👁️ View Profile | ✏️ Edit | 📞 Call | 💬 WhatsApp | ⚙️ Permissions

**Add/Edit Agent Modal:**
- Personal Info: Name*, Phone*, Email, CNIC, Address, Emergency Contact
- Account Setup: Username, Password (auto-generate option), Role (Agent/Manager)
- Permissions Matrix (Checkboxes):
  • Cases: View Own | View All | Create | Edit | Delete
  • Customers: View Own | View All | Create | Edit
  • Financials: View Reports | Record Payments | View All Transactions
  • Notifications: Send to Customers | Send Broadcasts | Manage Templates
  • System: View Settings | Edit Settings | Manage Users
- Territory Assignment: Dropdown of Pakistan cities/regions agent covers
- Commission Structure: % per case type or fixed amount
- Welcome Kit: Auto-generate PDF with login credentials, training resources, contact list

**Bulk Agent Actions:**
- Select multiple → Assign Cases | Send Notification | Update Permissions | Deactivate
- Export Agent List: CSV with all fields for payroll/HR

**Performance Review Interface:**
- Select Agent → Timeline view of their activity
- Metrics Comparison: vs. team average, vs. last month
- Customer Feedback: Aggregated ratings, verbatim comments
- Goal Setting: Set targets for next period, track progress
- Recognition: "Agent of the Month" badge assignment, bonus calculation

---

### 🕐 Attendance & Workforce Management System:

**Attendance Dashboard:**
- Calendar View: Month/Week/Day toggle
- Color-coded markers: 
  • Green: Checked-in on time
  • Yellow: Checked-in late (<30 min)
  • Orange: Checked-in late (>30 min)
  • Red: Absent
  • Blue: On leave (approved)
- Hover: Show check-in/out times, location (if GPS enabled)

**Daily Attendance Log:**
- Table: Agent Name | Scheduled Time | Check-in | Check-out | Total Hours | Status | Actions
- Filters: Date Range | Agent | Status (Present/Late/Absent/Leave)
- Bulk Actions: Approve Leave | Mark Absent | Export Timesheet

**Check-in/Check-out Flow (Agent Mobile App):**
- Geofencing: Only allow check-in within 100m of office location (configurable)
- Selfie Verification: Optional photo capture at check-in (stored securely)
- One-tap buttons: "Check In" / "Check Out" with confirmation modal
- Late Check-in: Auto-calculate delay, prompt for reason (dropdown: Traffic, Personal, Other)
- Offline Support: Queue check-in if no internet, sync when connected

**Leave Management:**
- Agent Request Flow: Select Dates | Leave Type (Sick/Vacation/Emergency) | Reason | Attach Document (optional) → Submit
- Admin Approval: Notification → Review → Approve/Reject with comment → Auto-update calendar
- Leave Balance Tracker: Show remaining days per leave type
- Holiday Calendar: Pakistan public holidays + company holidays pre-loaded

**Attendance Reports:**
- Monthly Summary: Per agent: Days Present, Late Arrivals, Absences, Leave Taken, Overtime
- Team Overview: Attendance rate %, peak absence days, patterns
- Payroll Integration: Export hours for salary calculation (CSV/Excel)
- Compliance: Generate labor law compliance reports

**Productivity Correlation:**
- Chart: Attendance consistency vs. Cases Closed vs. Customer Rating
- Insights: "Agents with >90% attendance close 23% more cases on average"
- Alerts: Flag agents with declining attendance + performance

---

### 💰 Financial Management Module:

**Payment Tracking Dashboard:**
- Overview Cards: Total Revenue MTD | Outstanding Receivables | Collection Rate | Avg. Transaction Value
- Recent Transactions Table: Date | Case ID | Customer | Amount | Method | Status | Agent
- Filters: Date | Payment Method | Status | Agent | Amount Range

**Payment Recording Interface:**
- Search Customer/Case: Type-ahead with recent cases
- Payment Details: Amount*, Currency (PKR/SAR/AED), Method* (Cash/EasyPaisa/JazzCash/Bank Transfer), Date*, Reference/Transaction ID
- Receipt Generation: Auto-create PDF receipt with company logo, case details, payment breakdown
- Split Payments: Support for installment plans (e.g., 50% now, 50% after visa approval)
- Refund Processing: Full/partial refund with approval workflow and audit trail

**Financial Reconciliation:**
- Bank Statement Import: Upload CSV/PDF → Auto-match transactions
- Discrepancy Alerts: Flag unmatched payments, duplicate entries
- Agent Commission Calculator: Auto-calculate based on cases closed × commission rate
- Tax Reporting: GST/VAT summary, deductible expenses categorization

**Budget vs. Actual:**
- Expense Categories: Office Rent, Utilities, Marketing, API Costs, Agent Commissions, Training
- Monthly Budget Allocation vs. Actual Spend with variance analysis
- Forecasting: Project next quarter expenses based on historical trends

---

### ⚙️ System Settings & Configuration:

**Notification Templates Manager:**
- Channel Tabs: WhatsApp | SMS | Email | In-App
- Template Library: 
  • Country-specific: Saudi Medical Reminder (Urdu), UAE Visa Update (English)
  • Process-based: Document Received Confirmation, Payment Receipt, Appointment Scheduled
  • Alert templates: Payment Overdue, Document Expiry Warning, Case Rejection Guidance
- Editor: Rich text with variables {{customer_name}}, {{case_id}}, {{appointment_time}}
- Preview: Show how template renders in WhatsApp/SMS/email
- Test Send: Send template to admin's phone/email for verification

**Automation Rules Engine:**
- Visual Workflow Builder: Drag-and-drop interface
- Trigger Conditions (Dropdown):
  • Case Status Changed → [New Value]
  • Payment Received → [Amount/Stage]
  • Appointment Date = Tomorrow/Today
  • Document Uploaded → [Type]
  • Visa Decision Received → [Approved/Rejected]
  • Case Inactive > [X] Days
  • Agent Attendance = Absent
- Actions (Multi-select):
  • Send WhatsApp/SMS/Email to: Customer | Agent | Manager | All
  • Update Case Status
  • Create Task for: [User Role]
  • Add Calendar Event
  • Generate Document (Receipt, Letter, Checklist)
  • Escalate to Manager
  • Log to Audit Trail
- Testing: "Run Test" button with sample data to validate rule logic
- Activation: Toggle On/Off per rule, schedule active hours

**User Roles & Permissions Matrix:**
- Pre-defined Roles: Admin, Manager, Senior Agent, Agent, Support Staff
- Custom Role Builder: Name role → Check permissions from master list → Save
- Permission Categories: Cases, Customers, Financials, Notifications, System, Reports
- Inheritance: Child roles inherit parent permissions unless explicitly denied

**Data Management:**
- Backup Schedule: Daily automated backups to cloud storage
- Data Export: Full database export (encrypted) for migration/compliance
- Data Retention Policies: Auto-archive cases completed >2 years ago
- GDPR/Privacy Tools: Customer data export/delete requests workflow

**Integration Settings:**
- WhatsApp Business API: Phone number verification, template approval status, webhook URL
- SMS Gateway: Provider selection (Jazz/EasyPaisa/Twilio), API key management, sender ID
- Payment Gateways: EasyPaisa/JazzCash merchant credentials, webhook endpoints
- Calendar Sync: Google Calendar OAuth connection, two-way sync settings
- Map Services: Google Maps API key for location features

---

## 💼 AGENT PORTAL (LIMITED ACCESS - CASE FOCUSED)

### Agent Dashboard (Home):
**A. Personal Welcome Header:**
- "Assalamualikum, [Agent Name] 👋"
- Today's Date (Hijri + Gregorian) + Prayer Times (optional toggle)
- Quick Stats Row: My Cases(23) | Pending Actions(7) | Today's Appointments(3) | Attendance: ✅ Checked-in 9:15 AM

**B. Today's Task List (Priority-Ordered):**
1. 🔴 Urgent: Follow up with Ahmed Khan - Medical appointment tomorrow at Green Center, Lahore
   - Actions: [📞 Call] [💬 WhatsApp] [✅ Mark Done]
2. 🟡 Pending: Verify uploaded documents for Fatima Bibi (CNIC, Passport)
   - Actions: [👁️ Review] [✏️ Request Re-upload]
3. 🔵 Reminder: Send payment reminder to Muhammad Aslam - PKR 25,000 due tomorrow
   - Actions: [💬 Send WhatsApp] [📧 Send Email] [⏰ Snooze]
4. 🟢 Scheduled: Pre-departure briefing with Ali Raza today at 3 PM
   - Actions: [📍 Get Directions] [📝 Prepare Notes]

**C. Quick Actions Floating Button (Bottom Right):**
- + New Case (Primary Emerald)
- Secondary ring: 📞 Call List | 💬 Broadcast | 📅 Schedule | 📊 My Reports

**D. My Performance Snapshot:**
- Mini Chart: Cases Closed This Month (vs. target)
- Customer Rating: ⭐ 4.8/5 (24 reviews)
- Attendance Streak: 🔥 12 days on time
- Click → Detailed Performance Report

**E. Upcoming Appointments Calendar (Mini View):**
- Day view with color-coded events: Medical(Orange) | Payment(Blue) | Meeting(Green) | Deadline(Red)
- Click event → Quick details + Reschedule option
- "View Full Calendar" link → Dedicated Calendar page

---

### My Cases Management (Agent View):

**Case List Interface:**
- Search Bar: Type customer name, phone, case ID, destination
- Filter Chips (Toggle): 
  • Status: New | Documents | Medical | Visa | Ticket | Completed | Rejected
  • Destination: Saudi | UAE | Qatar | Kuwait | Oman
  • Priority: High | Normal | Low
  • Date: Today | This Week | This Month
- Sort Options: Last Updated | Priority | Customer Name | Appointment Date

**Case Card Design (Mobile-Optimized):**
┌─────────────────────────────────┐
│ [Photo] Ahmed Khan │
│ 🇸 Saudi Arabia • Driver │
│ 🟡 Medical Stage │
│ 📅 Appointment: Tomorrow 10 AM │
│ 📍 Green Medical Center, LHR │
│ │
│ [👁️ View] [📞 Call] [💬 WhatsApp] │
└─────────────────────────────────┘

- Swipe Actions (Mobile): Swipe left → [Call] [WhatsApp] [Edit] | Swipe right → [Complete] [Escalate]
- Long Press: Quick status change dropdown
- Bulk Select: Checkbox top-left → Select multiple → Bulk actions bar appears

**Case Detail View (Tabbed Interface):**

📋 Info Tab:
- Customer Profile: Name, Father Name, CNIC (masked: XXXXX-XXX-XX), Passport#, Phone, WhatsApp, Address, City
- Job Details: Destination Country, Job Type, Expected Salary, Experience Years, Skills
- Emergency Contact: Name, Relation, Phone
- Edit Button: Pencil icon → Inline editing with save/cancel

📄 Documents Tab:
- Checklist Grid:
☑ Passport Copy [✅ Verified] Uploaded: 12 Feb Expiry: N/A
☑ CNIC Copy [✅ Verified] Uploaded: 12 Feb Expiry: 2030
☐ Photos (4) [⏳ Pending] - -
☐ Experience Letter [❌ Rejected] Uploaded: 10 Feb Reason: Unclear stamp
☐ Police Character [⏳ Pending] - -
☐ Medical Fitness [⏳ Pending] - -
- Upload Button per item: Opens file picker (PDF/JPG/PNG, max 5MB) → Progress bar → Preview thumbnail
- Verification Actions: [✅ Approve] [❌ Reject + Reason] [🔄 Request Re-upload]
- Expiry Alerts: Auto-highlight documents expiring <6 months in orange

💰 Payments Tab:
- Fee Summary: Total Service Fee: PKR 50,000 | Paid: PKR 25,000 | Remaining: PKR 25,000 | Due Date: 28 Feb 2026
- Payment Plan: Installment 1 of 2 (50% upfront, 50% after visa approval)
- Transaction History:
15 Feb 2026 | PKR 25,000 | EasyPaisa | Ref: EP20260215XYZ | Received by: Agent Farhan | [📄 Receipt]
- Record New Payment Button: Opens modal → Amount, Method, Reference, Date, Receipt Photo → Save
- Send Payment Reminder: Pre-filled WhatsApp template → Edit → Send

🏥 Medical/Biometric Tab:
- Center Details: Name, Address, Contact, Google Maps link
- Appointment: Date, Time, Type (Medical/Biometric), Status (Scheduled/Completed/Rescheduled/Failed)
- Actions: [📅 Reschedule] [🔔 Send Reminder (24h before)] [✅ Mark Completed] [❌ Mark Failed + Reason]
- Auto-Reminder Toggle: "Send WhatsApp 24 hours before + SMS morning of" (default: ON)
- Post-Appointment Notes: Textarea for agent observations

🛂 Visa Processing Tab:
- Embassy/Consulate: Dropdown (Saudi Embassy Islamabad, UAE Consulate Karachi, etc.)
- Application Timeline: Submitted Date | Expected Decision | Tracking Number (if available)
- Status Tracker: Submitted → Under Review → Approved → Rejected → Stamped (visual stepper)
- Status Change: Dropdown + confirmation modal + auto-log to notification history
- Internal Notes: Rich text area for embassy communications, special instructions

✈️ Travel Tab:
- Flight Details: Airline, Flight #, Departure Date/Time, Arrival Date/Time, PNR
- Pre-Departure Checklist:
☑ Orientation Session Completed
☑ Final Document Pack Prepared
☑ Airport Transfer Arranged
☐ Gulf Side Pickup Confirmed
☐ Emergency Contact Shared with Family
- Airport Pickup Contact: Name, Phone, Company (Gulf employer/agency)
- Travel Insurance: Policy #, Provider, Coverage details

🔔 Notifications Tab:
- Sent History: Date | Channel | Recipient | Template | Status (Sent/Delivered/Read/Failed)
- Manual Send: Compose new → Select template or custom → Preview → Send to Customer/Agent/Manager
- Delivery Analytics: Open rates, response times (for WhatsApp Business API)

📝 Internal Notes Tab:
- Threaded Comments: Like chat interface, @mention teammates to assign tasks
- File Attachments: Drag-drop screenshots, PDFs, voice notes
- Pin Important Notes: Star icon → Appears at top of thread
- Audit Trail: Each edit shows "Edited by [Agent] at [Time]"

---

### 🗓️ Agent Calendar & Scheduling:

**Calendar Views:**
- Day View: Hourly timeline with color-coded appointments
- Week View: 7-day grid with drag-and-drop rescheduling
- Month View: Overview with event dots, click day → expand details
- List View: Chronological list of upcoming appointments

**Event Types (Color-Coded):**
- 🟠 Medical Appointment
- 🔵 Payment Follow-up
- 🟢 Customer Meeting
- 🔴 Document Deadline
- 🟣 Visa Submission
- ⚪ Internal Task

**Event Creation/Edit Modal:**
- Title*, Type*, Date/Time*, Customer/Case (type-ahead search)
- Location: Text input + Google Maps picker
- Reminder Settings: 15 min before | 1 hour before | 1 day before (multi-select)
- Recurrence: Daily/Weekly/Monthly options
- Attach Case: Link event to specific case for context
- Notes: Internal comments, preparation checklist

**Drag-and-Drop Interactions:**
- Drag event to new time slot → Auto-update in case timeline
- Resize event duration by dragging edges
- Conflict Detection: Warn if overlapping with existing appointment
- Bulk Reschedule: Select multiple events → Move together

**Sync & Integration:**
- Google Calendar Two-Way Sync: Toggle per agent, conflict resolution settings
- Outlook Export: .ics file download for corporate calendars
- Mobile Push: Calendar notifications via agent app

---

### 📊 Agent Performance & Analytics:

**Personal Dashboard Metrics:**
- Cases Closed: This Week/Month/Quarter with trend arrows
- Avg. Processing Time: vs. team average (faster/slower indicator)
- Customer Satisfaction: Star rating + recent testimonials
- Revenue Generated: Total fees collected from assigned cases
- Attendance Score: % days on time, streak counter

**Goal Tracking:**
- Admin-Set Targets: Cases/month, Revenue target, Customer rating minimum
- Progress Bars: Visual completion % with milestone celebrations
- Self-Set Goals: Optional personal targets with private tracking

**Activity Heatmap:**
- Calendar-style grid showing daily activity volume
- Color intensity = number of cases updated/notifications sent
- Insights: "You're most productive on Tuesday mornings"

**Export & Share:**
- Monthly Performance Report: Auto-generated PDF for review meetings
- Share with Manager: One-click send summary via WhatsApp/email
- Personal Archive: Download all performance data for portfolio

---

### 🕐 Agent Attendance Module:

**Check-in/Check-out Interface:**
- Large Primary Buttons: "Check In" / "Check Out" (only active during work hours)
- Geofence Status: "📍 You're at office" / "⚠️ Outside office area - check-in anyway?"
- Optional Selfie: Camera button → Capture → Blur background → Attach to attendance record
- Late Check-in Flow: Auto-calculate delay → Prompt for reason (Traffic/Personal/Emergency) → Submit
- Offline Mode: Queue check-in locally → Auto-sync when internet restored

**Attendance History:**
- Monthly Calendar View: Color-coded days (Green=On time, Yellow=Late, Red=Absent, Blue=Leave)
- Daily Log: Check-in time, Check-out time, Total hours, Location, Notes
- Export: Download timesheet for payroll (CSV/Excel)

**Leave Management:**
- Request Leave: Select dates, leave type (Sick/Vacation/Emergency), reason, attach document (optional)
- Leave Balance: Show remaining days per type (e.g., Sick: 3/5 days left)
- Approval Status: Pending/Approved/Rejected with admin comments
- Holiday Calendar: Pakistan public holidays + company holidays pre-marked

**Attendance Reports (Agent View):**
- Personal Summary: Days present, late arrivals, absences, leave taken this month
- Productivity Correlation: "Your case closure rate is 15% higher on days you check in before 9:30 AM"
- Tips: "Try checking in 15 minutes earlier to avoid rush hour delays"

---

## 👤 CUSTOMER PORTAL (VIEW-ONLY + LIMITED INTERACTION)

### Customer Dashboard (Home):
**A. Personalized Welcome:**
- "Assalamualikum, [Customer Name] 👋"
- Case ID: EMR-2024-XXXX (prominent display)
- Current Stage Badge: Large, color-coded with icon (e.g., 🟡 Medical Stage)

**B. Visual Case Timeline (Hero Component):**
┌─────────────────┐ ┌─────────────────┐
│ EasyPaisa │ │ JazzCash │
│ [Icon] │ │ [Icon] │
│ "Pay in app" │ │ "Pay in app" │
└─────────────────┘ └─────────────────┘
┌─────────────────┐
│ Bank Transfer │
│ [Icon] │
│ "Get details" │
└─────────────────┘

**"I've Paid" Flow:**
- Button: "I've Made the Payment" → Opens form:
  • Transaction ID/Reference*
  • Payment Date*
  • Screenshot Upload (optional but recommended)
  • [Submit for Verification]
- Confirmation: "✅ Submitted! Our team will verify within 24 hours"
- Status Tracking: "Verification Status: Pending → Verified"

**Payment History:**
- Timeline of past payments: Date | Amount | Method | Status
- Download Receipts: PDF button per transaction

---

### Notifications (Customer View):

**Read-Only Feed:**
- Chronological list of updates from Emerald Visa
- Each item: Icon + Title + Brief message + Timestamp
- Action Buttons (contextual):
  • Medical reminder: [Add to Calendar] [Contact Agent]
  • Document verified: [View Document] [Upload Next]
  • Visa approved: [Celebrate 🎉] [Next Steps]

**Notification Preferences:**
- Toggle channels: WhatsApp ✅ | SMS ✅ | Email ❌ | In-App ✅
- Frequency: Immediate | Daily Digest | Weekly Summary
- Test Notification: "Send test to confirm settings"

**Archive & Search:**
- Swipe left to archive old notifications
- Search bar: Find past updates by keyword

---

### Contact Agent (Direct Communication):

**Agent Profile Card:**
- Photo, Name, Title ("Your Dedicated Agent")
- Rating: ⭐ 4.8/5 (24 customers)
- Response Time: "Typically replies within 2 hours"
- Availability: "Online now" / "Will respond by 6 PM"

**One-Tap Communication:**
- 💬 WhatsApp Button: Deep link to pre-filled message: "Assalamualikum, I'm [Name] (Case EMR-XXXX). I need help with..."
- 📞 Call Button: tel:+923186986259 with confirmation modal
- 📝 Quick Message Templates:
  • "Update please" → Sends predefined status request
  • "Document issue" → Opens upload helper
  • "Payment done" → Triggers verification workflow
  • "General question" → Free text field

**Conversation History (Optional):**
- If using in-app chat: Threaded messages with agent
- File sharing: Send documents directly in chat
- Read receipts + typing indicators

---

## 🔄 PROTOTYPE INTERACTIONS & MICRO-INTERACTIONS (MAKE EVERYTHING "WORKING")

### Login Flow:
- Role card hover: Scale 1.02 + subtle shadow increase
- Role card click: Slide-up animation to login form (300ms ease-out)
- Phone input focus: Border color change to Emerald + helper tooltip fade-in
- Invalid phone format: Shake animation + red border + error message slide-down
- OTP auto-advance: Smooth focus jump to next field with subtle bounce
- Verify success: Confetti animation + success checkmark + redirect with fade

### Dashboard Interactions:
- Stats card hover: Lift 4px + shadow increase + subtle background tint
- Stats card click: Modal slide-up with detailed chart + export options
- Notification bell click: Dropdown slide-down with unread badge animation
- Mark as read: Item fades to gray + badge count decrements with animation
- Language toggle: Instant text switch + RTL layout flip for Urdu (smooth transition)

### Case Management:
- Search bar: Type-ahead suggestions with debounce (300ms) + highlight matches
- Filter chip toggle: Smooth scale animation + active state color change
- Status badge click: Dropdown slide-down with all stage options
- Stage change: Badge color transition + toast notification "Status updated to [X]"
- Row swipe (mobile): Horizontal drag with resistance + reveal action buttons
- Bulk select: Checkbox animation + action bar slide-up from bottom

### Document Upload:
- Upload button hover: Scale 1.05 + color darken
- File picker open: System dialog + overlay fade-in
- Upload progress: Animated progress bar + percentage counter
- Success: Thumbnail fade-in + checkmark animation + status badge update
- Remove file: X button hover: red tint + click: slide-out animation + confirmation modal

### Form Navigation:
- Multi-step progress bar: Clickable segments with validation gate
- "Next" button: Validate current step → Show errors if any → Animate slide to next step
- Auto-save indicator: "Saving..." spinner → "Saved ✓" checkmark + timestamp update
- Draft recovery: Return within 7 days → Modal "Continue your draft?" with preview

### Calendar Interactions:
- Drag event: Visual ghost follow + snap-to-grid animation
- Resize event: Edge handles + live duration update tooltip
- Conflict detection: Red highlight + warning tooltip "Overlaps with [Event]"
- Click event: Modal slide-up with details + edit/delete options

### Notification Sending:
- Compose modal: Template selector → Preview pane updates in real-time
- Send button: Loading spinner → Success toast + log entry animation
- Delivery status: Real-time update icons (Sent→Delivered→Read) with color changes

### Mobile-Specific:
- Bottom navigation: Tap icon → Scale animation + active indicator slide
- Pull-to-refresh: Spinner animation + "Updated" toast
- Offline indicator: Banner slide-down with "Changes will sync when connected"
- Haptic feedback simulation: Visual ripple on button press

---

## 🎨 COMPREHENSIVE DESIGN SYSTEM COMPONENTS

### Buttons (4 Core Variants × 4 States):
**Primary (Emerald):**
- Default: bg-#50C878, text-white, shadow-sm
- Hover: bg-#45b369, scale-1.02
- Pressed: bg-#3a9e5a, scale-0.98
- Disabled: bg-gray-300, text-gray-500, cursor-not-allowed

**Secondary (Outline):**
- Default: bg-white, border-2 border-#50C878, text-#50C878
- Hover: bg-#f0fdf4, border-#45b369
- Pressed: bg-#dcfce7, border-#3a9e5a
- Disabled: border-gray-300, text-gray-400

**Danger (Red):**
- Default: bg-#EF4444, text-white
- Hover: bg-#dc2626
- Pressed: bg-#b91c1c
- Disabled: bg-gray-300, text-gray-500

**Ghost (Text-only):**
- Default: text-#50C878, bg-transparent
- Hover: bg-#f0fdf4, text-#45b369
- Pressed: bg-#dcfce7, text-#3a9e5a
- Disabled: text-gray-400

### Status Badges (7 Variants):
- New: bg-#FEF3C7, text-#92400E, icon: 🟡
- Documents: bg-#DBEAFE, text-#1E40AF, icon: 🔵
- Medical: bg-#FFEDD5, text-#C2410C, icon: 🟡
- Visa: bg-#D1FAE5, text-#065F46, icon: 🟢
- Ticket: bg-#EDE9FE, text-#5B21B6, icon: 🟠
- Completed: bg-#10B981, text-white, icon: ✅ + checkmark
- Rejected: bg-#FEE2E2, text-#991B1B, icon: ❌ + X

### Form Fields (3 States):
**Default:**
- Border: 1px solid #D1D5DB
- Focus: Border-2 border-#50C878, ring-2 ring-emerald-200
- Placeholder: text-gray-400

**Error:**
- Border: 2px solid #EF4444
- Error message: text-#EF4444, text-sm, mt-1, slide-down animation
- Icon: Red exclamation mark right-aligned

**Success:**
- Border: 2px solid #10B981
- Success icon: Green checkmark right-aligned
- Helper text: text-#10B981, "Verified ✓"

### Cards & Containers:
**Case Card:**
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Hover: Shadow-lg, transform: translateY(-4px)
- Selected: Left border-4 border-#50C878, bg-#f0fdf4

**Stats Card:**
- Gradient bg: linear-gradient(135deg, #50C878, #3a9e5a)
- Icon: Large, white, left-aligned
- Number: 2xl font-bold, white
- Label: text-sm, white/90
- Trend: Arrow icon + percentage, subtle animation

### Navigation Components:
**Sidebar (Desktop):**
- Collapsible: Icon-only mode + full label mode
- Active item: bg-#f0fdf4, left border-4 border-#50C878, font-medium
- Hover: bg-gray-50, subtle transition

**Bottom Nav (Mobile):**
- Fixed position, bottom-0, full-width
- Active icon: text-#50C878, scale-1.1, label bold
- Inactive: text-gray-500
- Badge: Absolute top-right on icon for notifications

### Modals & Overlays:
**Standard Modal:**
- Backdrop: bg-black/50, fade-in
- Content: White bg, rounded-xl, shadow-2xl, slide-up animation
- Close: X button top-right + ESC key + click outside
- Scroll: Internal scroll if content overflows viewport

**Confirmation Modal:**
- Warning icon: Yellow triangle with exclamation
- Title: Bold, "Confirm Action"
- Message: Clear consequence description
- Buttons: Cancel (secondary) + Confirm (danger/primary based on action)

### Toast Notifications:
**Success:**
- bg-#10B981, text-white, icon: ✅
- Auto-dismiss: 3 seconds with progress bar
- Position: Bottom-right, slide-up entrance

**Error:**
- bg-#EF4444, text-white, icon: ❌
- Manual dismiss: X button
- Position: Bottom-right, slide-up entrance

**Info:**
- bg-#2563EB, text-white, icon: ℹ️
- Action button: Optional "View Details" link

---

## 📱 MOBILE OPTIMIZATION SPECIFICS

### Breakpoints & Responsive Behavior:
- Mobile: 375px-390px width (iPhone 15 standard)
- Tablet: 768px width (iPad mini)
- Desktop: 1440px width (standard laptop)
- Fluid typography: clamp(14px, 2vw, 16px) for body text

### Thumb Zone Design:
- Primary actions positioned in bottom 120px of screen
- Secondary actions: Middle third, easily reachable
- Destructive actions: Top third or behind confirmation to prevent accidental taps

### Touch Targets:
- Minimum size: 44x44px for all interactive elements
- Spacing: 8px minimum between tappable items
- Visual feedback: Ripple animation on press, scale effect on buttons

### Performance Optimizations:
- Image lazy loading: Blur-up placeholders for document thumbnails
- Code splitting: Load only visible tab content initially
- API caching: Store frequently accessed data (agent info, country lists) locally
- Offline support: Queue form submissions, sync when connection restored

### Accessibility:
- Color contrast: Minimum 4.5:1 for text, verified with WCAG AA
- Screen reader labels: aria-labels for icons, logical tab order
- Reduced motion: Respect prefers-reduced-motion media query
- Font scaling: Support dynamic type up to 200% without layout break

---

## 🔐 SECURITY, PRIVACY & COMPLIANCE FEATURES

### Role-Based Access Control (RBAC):
**Permission Matrix:**
Feature
Admin
Manager
Agent
Customer
View all cases
✅
✅
❌
❌
View own cases
✅
✅
✅
✅
Create case
✅
✅
✅
❌
Edit case
✅
✅
✅*
❌
Delete case
✅
❌
❌
❌
View financials
✅
✅
❌
❌
Record payment
✅
✅
✅
❌
Send notifications
✅
✅
✅*
❌
Manage users
✅
❌
❌
❌
System settings
✅
❌
❌
❌
Attendance management
✅
✅
✅
❌
*Agent: Only for assigned cases/customers

### Data Protection Measures:
**Sensitive Data Handling:**
- CNIC/Passport numbers: Masked in lists (XXXXX-XXX-XX), full view only in detail with permission
- Phone numbers: Click-to-call with tel: protocol, not plain text export
- Document storage: Encrypted at rest, access-logged, auto-delete after case completion + retention period

**Audit Trail:**
- Every data change logged: Timestamp, User, Action, Before/After values
- Exportable audit report: For compliance reviews, internal investigations
- Immutable logs: Cannot be edited/deleted even by admins

**Compliance Badges Display:**
- Footer: "🔐 Data Protected | 📜 Licensed Consultancy | 💳 Secure Payments"
- Hover tooltips: Explain each certification/compliance standard
- Click: Link to privacy policy, terms of service, license verification

---

## 🔄 INTEGRATIONS & API PLACEHOLDERS

### Communication Channels:
**WhatsApp Business API:**
- Placeholder icon + status indicator (Connected/Disconnected)
- Template approval workflow: Draft → Submit to Meta → Approved/Rejected
- Webhook endpoint: /api/whatsapp/webhook for message delivery receipts
- Rate limiting: Show "X messages remaining today" counter

**SMS Gateway (Pakistan):**
- Provider selector: Jazz SMS | EasyPaisa SMS | Twilio
- API key management: Masked input + test connection button
- Sender ID: Configurable (e.g., "EmeraldVisa")
- Delivery reports: Sent/Delivered/Failed status per message

### Payment Tracking (Not Processing):
**Manual Recording:**
- Agent records payment received via external channels
- Fields: Amount, Method, Reference, Date, Receipt Photo
- Status: Pending Verification → Verified → Reconciled

**EasyPaisa/JazzCash Deep Links:**
- Generate payment request link: Opens customer's Easypaisa app with pre-filled amount
- Webhook for confirmation: /api/payment/webhook (placeholder)
- Reconciliation: Match transaction IDs with bank statements

### Calendar & Location Services:
**Google Calendar Sync:**
- OAuth flow placeholder: "Connect Google Account" button
- Two-way sync settings: Which events to sync, conflict resolution rules
- ICS export: Download calendar file for Outlook/Apple Calendar

**Google Maps Integration:**
- Medical center location picker: Search + pin drop + address autocomplete
- Directions link: Open in Google Maps app with destination pre-filled
- Geofencing: Define office coordinates for attendance check-in validation

### Storage & File Management:
**Cloud Storage Placeholder:**
- Document upload endpoint: /api/documents/upload
- File validation: Type, size, virus scan (placeholder logic)
- CDN delivery: Optimized image URLs for thumbnails

**Backup & Recovery:**
- Automated daily backups: Indicator showing last backup time
- Point-in-time restore: Admin interface to restore case to previous state
- Export full case: ZIP with all documents, notes, timeline for archival

---

## 🎯 UX PRINCIPLES & GUIDELINES

1. **Speed First (Pakistan Context):**
   - Optimize for 3G networks: Compress images, lazy load non-critical content
   - Minimize API calls: Batch requests, cache frequently accessed data
   - Progressive enhancement: Core functionality works without JS, enhanced with JS

2. **Urdu-First Design:**
   - Default language: Urdu for customer/agent portals, English for admin
   - RTL layout support: Proper text alignment, icon positioning, navigation flow
   - Font fallback chain: Jameel Noori Nastaleeq → Noto Nastaliq Urdu → system serif

3. **Thumb Zone Optimization:**
   - Critical actions (Submit, Save, Call) positioned in bottom 1/3 of mobile screen
   - Secondary actions (Edit, Share, More) in middle third
   - Destructive actions (Delete, Reject) require confirmation or positioned top

4. **Offline-Resilient Architecture:**
   - Queue actions when offline: Show "Will sync when connected" indicator
   - Local storage: Cache case data, form inputs, user preferences
   - Conflict resolution: Last-write-wins with audit log for manual review

5. **Error Prevention & Recovery:**
   - Confirm before destructive actions: Modal with clear consequences
   - Auto-save drafts: Every 30 seconds + manual save button
   - Undo functionality: Toast with "Undo" link for recent actions (5-second window)

6. **Accessibility by Default:**
   - Color contrast: Verified WCAG AA compliance for all text/background combinations
   - Keyboard navigation: Logical tab order, visible focus indicators
   - Screen reader support: ARIA labels, semantic HTML structure, skip links

---

## 🚫 DESIGN AVOIDANCES

- ❌ Overly complex multi-step forms → Break into wizard with progress indicator
- ❌ Dense tables on mobile → Use card layout with expandable rows, horizontal scroll only when necessary
- ❌ Generic stock icons → Use custom visa/recruitment icon set (passport, visa stamp, airplane, medical cross)
- ❌ Assume high-speed internet → Optimize images (WebP fallback), lazy load, show loading skeletons
- ❌ Hidden navigation → Keep primary actions visible or one tap away, avoid hamburger menus on mobile
- ❌ Unclear error states → Show specific, actionable error messages with recovery suggestions
- ❌ Inconsistent spacing → Strict 8px grid system, use auto-layout for responsive spacing

---

## ✅ DELIVERABLES & OUTPUT SPECIFICATIONS

### 1. Web CRM Frames:
- **Desktop (1440px width):** Admin Dashboard, Case Management, Reports, Settings, Attendance
- **Tablet (768px width):** Responsive adaptations of above with adjusted layouts
- **Prototype Connections:** All interactive elements linked with appropriate transitions

### 2. Mobile App Frames:
- **iOS (390x844px):** Agent App (Login, Dashboard, Cases, Calendar, Attendance), Customer App (Login, Timeline, Upload, Payment)
- **Android (360x800px):** Adapted layouts with material design considerations
- **Offline States:** Visual designs for no-internet scenarios with queued actions

### 3. Component Library Page:
- **Buttons:** All variants × states with usage guidelines
- **Badges:** Status indicators with color codes and icons
- **Form Fields:** Input, select, checkbox, radio with validation states
- **Cards:** Case card, stats card, agent card with hover/selected states
- **Navigation:** Sidebar, bottom nav, breadcrumbs with active states
- **Modals:** Confirmation, form, full-screen with backdrop handling
- **Auto-Layout Examples:** Responsive containers with spacing tokens

### 4. Prototype Flows (Fully Interactive):
- **Role Selection → Login → Dashboard:** Complete authentication journey
- **New Case Creation:** 6-step wizard with validation, auto-save, draft recovery
- **Document Upload:** File picker → progress → preview → verification workflow
- **Status Change:** Badge click → dropdown → confirmation → timeline update
- **Attendance Check-in:** Geofence validation → selfie (optional) → confirmation
- **Notification Sending:** Template selection → preview → send → delivery tracking
- **Payment Recording:** Form → receipt generation → customer confirmation

### 5. Theme Variants:
- **Dark Mode:** Key screens with dark background (#1a1a1a), light text, adjusted shadows
- **Light Mode:** Default with white backgrounds, dark text
- **Toggle Interaction:** Smooth transition animation between themes

### 6. Localization Examples:
- **Urdu/English Toggle:** Same screen with both languages, demonstrating RTL layout
- **Date/Number Formatting:** PKR currency, Hijri/Gregorian dates, phone number masks
- **Cultural Considerations:** Prayer time indicators, holiday calendars, appropriate imagery

---

## 📋 FINAL COMPREHENSIVE CHECKLIST

□ Role-based login landing page with 3 distinct portals (Admin/Agent/Customer) ✓
□ Admin Portal: Full reports, analytics, team management, financials, system settings ✓
□ Admin: Attendance management system for agents with geofencing, leave, reporting ✓
□ Agent Portal: My cases, calendar, notifications, performance tracking ✓
□ Agent: Attendance check-in/out with geofencing, selfie option, offline support ✓
□ Agent: "Make Case" deep flow with 6 steps, validation, auto-save, draft recovery ✓
□ Customer Portal: Visual timeline, document upload, payment status, contact agent ✓
□ All forms with real-time validation, auto-formatting (CNIC, phone), error handling ✓
□ Document upload with progress, preview, verification workflow, expiry alerts ✓
□ Status badges clickable with change workflow + audit logging ✓
□ Notifications: Compose, template library, send, delivery tracking, preferences ✓
□ Calendar: Drag-and-drop, Google sync, conflict detection, mobile optimization ✓
□ Mobile: Thumb-friendly, offline indicator, pull-to-refresh, haptic feedback ✓
□ Prototype: All clicks/taps have visual feedback, navigation, micro-interactions ✓
□ Component library with variants, states, usage guidelines for dev handoff ✓
□ Dark/Light mode + Urdu/English toggle with RTL support examples ✓
□ Brand colors (#50C878, #D4AF37) applied consistently with contrast compliance ✓
□ Contact info (03186986259, address) visible in footer across all screens ✓
□ Trust elements: License badges, secure data icons, compliance statements ✓
□ Pakistan-specific optimizations: 3G performance, Urdu-first, local payment methods ✓
□ Security: RBAC matrix, data masking, audit trail, encryption placeholders ✓
□ Integrations: WhatsApp/SMS API, payment tracking, calendar sync, maps placeholders ✓
□ Accessibility: WCAG AA contrast, keyboard nav, screen reader labels, reduced motion ✓
□ Export ready: PDF reports, Excel data, PNG presentations, WhatsApp summaries ✓

---

**INSTRUCTIONS FOR FIGMA AI:**
1. Generate all frames with auto-layout for responsive behavior
2. Create component variants for buttons, badges, form fields with all states
3. Connect prototype flows with appropriate animations (Smart Animate, 200-300ms)
4. Use variables for colors, spacing, typography to enable theme switching
5. Include Urdu text examples with proper RTL layout demonstration
6. Optimize for mobile first: design 390px frames, then scale up to desktop
7. Add micro-interactions: hover states, loading animations, success confirmations
8. Ensure all interactive elements have visual feedback in prototype mode

**This prompt is designed to generate a production-ready, deeply functional CRM design system that can be handed off to developers for implementation. Every feature considers the Pakistan-based visa consultancy context, mobile-first users, and bilingual requirements.**


