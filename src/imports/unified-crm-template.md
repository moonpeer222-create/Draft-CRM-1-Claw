## 🎨 **Figma AI Prompt: Unified CRM Template - Mobile-First Optimized**

```markdown
ACT AS: Senior Product Designer & Design System Architect.

TASK: Consolidate ALL Emerald Visa CRM portals (Admin, Agent, Operator, Customer) into a SINGLE, UNIFIED template without repetition, overlapping, or confusion. MOBILE-FIRST OPTIMIZED - design for phone first, then scale to tablet/desktop. Make it developer and user-friendly with clear structure, consistent components, and organized navigation.

CURRENT PROBLEM TO SOLVE:
❌ Multiple templates causing confusion
❌ Repeating elements across portals
❌ Overlapping features between roles
❌ Hard for developer to check/maintain
❌ Inconsistent UI patterns
❌ Not optimized for mobile (Pakistan agents use phones primarily)

GOAL:
✅ ONE master template for all roles (Mobile-First)
✅ Zero repetition (reuse components)
✅ Clear role-based visibility (show/hide, not duplicate)
✅ Developer-friendly structure (organized layers, naming)
✅ Consistent UI patterns across all portals
✅ Phone-first optimization (320px - 390px base)

---

## 🏗️ UNIFIED DESIGN SYSTEM STRUCTURE (Mobile-First)

### 1. 📐 SINGLE COMPONENT LIBRARY (No Duplicates):
Create ONE master component page with mobile-first variants:
```
📦 Components/
  ├── 🎨 Atoms (Buttons, Inputs, Badges, Icons) - Mobile sizes first
  ├── 🧩 Molecules (Cards, Form Fields, Search Bars) - Stack vertically
  ├── 🏠 Organisms (Headers, Sidebars, Tables, Dashboards) - Mobile nav first
  └── 📄 Templates (Page Layouts for all roles) - 390px base width
```
**Rules:**
- Each component = ONE source of truth (no variants per role)
- Role-based visibility controlled by props/conditions (e.g., `showForRole: ['admin', 'operator']`)
- All components use same design tokens (colors, spacing, typography)
- **Mobile-first:** Design for 390px first, then add tablet (768px) + desktop (1440px) breakpoints

### 2. 🎨 UNIFIED COLOR & TYPOGRAPHY TOKENS:
```
Colors (Single Source):
Take inspiration from the Admin portal
- Status: 🟢 Success #10B981 | 🟡 Warning #F59E0B | 🔴 Error #EF4444

Typography (Single Scale - Mobile Readable):
- Headings: Inter Bold (20px mobile, 24px tablet, 28px desktop)
- Body: Inter Regular (16px mobile minimum, 14px secondary)
- Urdu: Jameel Noori Nastaleeq (same sizes, RTL support)
- Touch Targets: Minimum 48px height for all interactive elements
```
**No role-specific colors or fonts.**

### 3. 🧭 SINGLE NAVIGATION STRUCTURE (Mobile-First + Role-Based):
```
📍 Mobile Navigation (Bottom Tab Bar - 390px):
├── 📊 Dashboard (All roles see, content varies by role)
├── 📁 Cases (All roles see, data filtered by role)
├── ➕ Quick Actions (Contextual based on role)
├── 🔔 Notifications (All roles, badge count varies)
├── 👤 Profile (All roles, settings vary by role)

📍 Tablet/Desktop Navigation (Sidebar - 768px+):
├── 📊 Dashboard
├── 📁 Cases
├── 📅 Appointments (Operator + Admin only)
├── 💰 Payments (Agent + Admin + Operator)
├── 👥 Attendance (Operator + Admin only)
├── 📈 Reports (Admin only)
├── ⚙️ Settings (Admin only)
└── 🎛️ Operations (Operator + Admin only)
```
**Implementation:**
- Same navigation component for ALL roles
- Mobile: Bottom tab bar (5 max items, thumb-friendly)
- Desktop: Sidebar (expandable, all menu items)
- Hide/show menu items based on user role (not separate navs)
- Consistent icons + labels across all portals

### 4. 📄 UNIFIED PAGE TEMPLATES (Mobile-First, No Duplicates):
Create ONE template per page type, mobile-first:

```
📄 Template: Dashboard (Mobile 390px First)
  ├── Header (Logo + Notification Bell + Profile - stacked on mobile)
  ├── Stats Cards (2-column grid on mobile, 4-column on desktop)
  ├── Widgets (Stack vertically on mobile, grid on desktop)
  └── Bottom Nav (Fixed, thumb zone optimized)

📄 Template: Case Detail (Mobile-First)
  ├── Header (Back button + Case ID + Status Badge)
  ├── Timeline (Vertical stepper on mobile, horizontal on desktop)
  ├── Tabs (Scrollable horizontal tabs on mobile)
  └── Action Buttons (Fixed bottom bar on mobile, inline on desktop)

📄 Template: List View (Mobile-First)
  ├── Search Bar (Full-width, sticky on mobile)
  ├── Filters (Collapsible drawer on mobile, sidebar on desktop)
  ├── Cards (Full-width cards on mobile, table on desktop)
  └── Pagination (Load More button on mobile, page numbers on desktop)
```
**Rule:** If 2 roles see similar page → Use SAME template, control visibility via permissions.

### 5. 🔐 ROLE-BASED PERMISSION LAYER (Visual Indicators):
Instead of separate portals, use permission badges:
```
[👁️ View Only] → For roles that can see but not edit
[✏️ Editable] → For roles that can modify
[🔒 Locked] → For roles that cannot access
[⚠️ Requires Approval] → For actions needing Admin confirmation
```
**Example:**
- Payment Record Button (Mobile):
  - Agent: Full-width button "Submit (Pending Approval)" ⚠️
  - Operator: Full-width button "Record (Pending Admin)" ⚠️
  - Admin: Full-width button "Approve/Reject" ✅

### 6. 🗂️ ORGANIZED FIGMA FILE STRUCTURE:
```
📁 Emerald Visa CRM (Single File - Mobile-First)
├── 📦 Cover Page (Project overview, version, last updated)
├── 🎨 Design System (Colors, Typography, Components, Icons)
│   ├── 📱 Mobile Components (390px base)
│   ├── 📱 Tablet Components (768px)
│   └── 🖥️ Desktop Components (1440px)
├── 📄 Pages (All screens organized by feature, not role)
│   ├── 🔐 Authentication (Login, Access Code - Mobile first)
│   ├── 📊 Dashboard (All role variants - 390px/768px/1440px)
│   ├── 📁 Cases (List, Detail, Create - Mobile first)
│   ├── 💰 Payments (List, Record, Approve - Mobile first)
│   ├── 📅 Appointments (Calendar, Log, Track - Mobile first)
│   ├── 👥 Attendance (Mark, View, Export - Mobile first)
│   ├── 📈 Reports (Generate, View, Export - Admin only)
│   ├── 🎛️ Operations (Operator + Admin only - Mobile first)
│   └── ⚙️ Settings (Admin only - Mobile first)
├── 🧪 Prototype Flows (Connected user journeys - Mobile tested)
├── 📝 Notes (Developer handoff, permissions matrix, API endpoints)
└── 🗑️ Archive (Old/duplicate screens - clearly marked)
```
**Naming Convention:**
- Pages: `01_Authentication`, `02_Dashboard`, `03_Cases` (numbered order)
- Frames: `Dashboard_Mobile`, `Dashboard_Tablet`, `Desktop_Desktop`
- Components: `Button/Primary/Mobile`, `Card/Case/Mobile`

### 7. 📱 MOBILE-FIRST OPTIMIZATION RULES:

#### Touch Targets:
```
✅ All buttons: Minimum 48px height (thumb-friendly)
✅ All inputs: Minimum 48px height
✅ All icons: Minimum 24px size
✅ Spacing between tappable elements: 8px minimum
✅ Swipe actions on list items (mobile only)
```

#### Layout:
```
✅ Single column layout on mobile (320px - 640px)
✅ Two column grid on tablet (641px - 1024px)
✅ Four column grid on desktop (1025px+)
✅ Bottom navigation on mobile (thumb zone)
✅ Sidebar navigation on desktop
✅ Sticky headers on mobile (scrollable content)
✅ Fixed action buttons at bottom (mobile)
```

#### Performance:
```
✅ Lazy load images on mobile
✅ Compress images for 3G networks (Pakistan context)
✅ Skeleton loaders for slow connections
✅ Offline indicator banner (mobile)
✅ Pull-to-refresh on mobile lists
```

#### Content:
```
✅ Truncate long text with ellipsis (mobile)
✅ Expandable sections for dense information
✅ Priority content above fold (mobile)
✅ Secondary actions in overflow menu (mobile)
✅ Full-screen modals on mobile, dialogs on desktop
```

### 8. 🔍 DEVELOPER-FRIENDLY FEATURES:
**For Easy Handoff:**
- ✅ Auto-layout on ALL frames (responsive behavior clear)
- ✅ Component properties labeled (e.g., `role= admin|agent|operator`)
- ✅ Annotations for permissions (e.g., "Show only if user.role === 'admin'")
- ✅ API endpoint notes on relevant components (e.g., "POST /api/payments")
- ✅ State variants documented (Default, Hover, Disabled, Error, Loading)
- ✅ No hidden layers (delete unused, don't hide)
- ✅ Consistent spacing (8px grid system throughout)
- ✅ **Breakpoint annotations** (Mobile/Tablet/Desktop behavior)

**For Easy Maintenance:**
- ✅ Version number on Cover Page (e.g., v2.0 - Unified Mobile-First)
- ✅ Change log section (what changed, when, why)
- ✅ Component usage count (identify unused duplicates)
- ✅ Clear "Deprecated" labels on old components (before deletion)
- ✅ **Responsive behavior documentation** per component

### 9. 🧹 DE-DUPLICATION CHECKLIST:
Before finalizing, verify:
```
□ All buttons use SAME button component (mobile-first sizes)
□ All inputs use SAME input component (no duplicates)
□ All cards use SAME card component (content varies, structure same)
□ All icons from SAME icon set (Lucide React, no mixed libraries)
□ All colors from SAME color tokens (no hex code duplicates)
□ All typography from SAME text styles (no manual font sizes)
□ All navigation uses SAME nav component (mobile bottom / desktop sidebar)
□ All dashboards use SAME layout grid (responsive breakpoints)
□ All case details use SAME template (mobile vertical / desktop horizontal)
□ All forms use SAME form structure (stacked mobile / grid desktop)
□ All tables convert to cards on mobile (no horizontal scroll)
□ All modals are full-screen on mobile (dialogs on desktop)
```

### 10. 📋 PERMISSIONS MATRIX (Single Source of Truth):
Create ONE reference table for all roles:
```
| Feature              | Admin | Operator | Agent | Customer |
|---------------------|-------|----------|-------|----------|
| View All Cases      | ✅    | ✅       | ❌    | ❌       |
| View Own Cases      | ✅    | ✅       | ✅    | ✅       |
| Create Case         | ✅    | ✅       | ✅    | ❌       |
| Edit Case Status    | ✅    | ❌ (Flag)| ✅    | ❌       |
| Upload Documents    | ✅    | ✅       | ✅    | ✅       |
| Record Payment      | ✅    | ✅       | ✅    | ❌       |
| Approve Payment     | ✅    | ❌       | ❌    | ❌       |
| View Payment History| ✅    | ✅       | ❌    | ❌       |
| Mark Attendance     | ✅    | ✅       | ✅    | ❌       |
| View Attendance     | ✅    | ✅       | ❌    | ❌       |
| Generate Reports    | ✅    | ✅ (Daily)| ❌   | ❌       |
| Access Operations   | ✅    | ✅       | ❌    | ❌       |
| System Settings     | ✅    | ❌       | ❌    | ❌       |
```
**Place this matrix in Figma Notes section for developer reference.**

### 11. 🎯 UNIFIED USER FLOWS (Mobile-First, No Overlapping Paths):
Create ONE flow per action, mobile-first:
```
🔄 Flow: Create Case (Mobile)
  Start → Login (OTP) → Dashboard (Mobile) → + New Case (FAB) → 
  Fill Form (Stacked) → Submit → Case Created → Toast Confirmation

🔄 Flow: Record Payment (Mobile)
  Start → Login → Case Detail (Mobile Tabs) → Payments Tab → 
  Record Payment (Full-screen form) → Upload Receipt (Camera) → 
  Submit → Pending Approval → Toast Confirmation

🔄 Flow: Confirm Status (Mobile)
  Start → Login → Case List (Cards) → Select Case → 
  Click Status (Bottom Sheet) → Confirm → Notify Admin → Toast
```
**Document each flow with mobile-specific interactions clearly marked.**

### 12. 📱 MOBILE-SPECIFIC COMPONENTS:
```
📱 Bottom Sheet Modal (Mobile) / Dialog (Desktop)
📱 Pull-to-Refresh (Mobile only)
📱 Swipe Actions on List Items (Mobile only)
📱 Floating Action Button (Mobile) / Inline Button (Desktop)
📱 Bottom Tab Navigation (Mobile) / Sidebar (Desktop)
📱 Full-Screen Forms (Mobile) / Modal Forms (Desktop)
📱 Camera Upload (Mobile) / File Picker (Desktop)
📱 Haptic Feedback Indicators (Mobile)
📱 Offline Banner (Mobile priority)
```

---

## 🎨 DESIGN RULES (Enforce Consistency - Mobile-First):

### Spacing:
```
- Use 8px grid system throughout (8, 16, 24, 32, 48, 64px)
- Mobile padding: 16px sides, 24px top/bottom
- Tablet padding: 24px sides, 32px top/bottom
- Desktop padding: 32px sides, 48px top/bottom
- No manual spacing values (use auto-layout spacing tokens)
```

### Colors:
```
- Use color tokens only (no hex codes directly on elements)
- Status colors consistent (🟢 Success, 🟡 Warning, 🔴 Error everywhere)
- High contrast for mobile outdoor visibility (Pakistan sunlight)
```

### Typography:
```
- Use text styles only (no manual font sizes/weights)
- Mobile minimum: 16px body text (readable on small screens)
- Urdu/English toggle uses same text styles (just different font family)
- Line height: 1.5x for mobile readability
```

### Components:
```
- Master component → All instances linked (no detached elements)
- Variants for states (Default, Hover, Disabled, Error, Loading)
- Variants for breakpoints (Mobile, Tablet, Desktop)
- No "similar" components (if 90% same → merge into one)
```

### Icons:
```
- Single icon library (Lucide React)
- Mobile: 24px minimum (touch-friendly)
- Desktop: 20px standard
- No custom icons unless absolutely necessary
```

---

## ✅ FINAL DELIVERABLES:

1. **Single Figma File** with organized structure (Mobile-First)
2. **Unified Component Library** (no duplicates, mobile sizes)
3. **Role-Based Variants** (show/hide, not separate components)
4. **Permissions Matrix** (in Notes section)
5. **Developer Handoff Notes** (API endpoints, conditions, states, breakpoints)
6. **Prototype Flows** (unified, mobile-tested, role-based decision points)
7. **Change Log** (what was consolidated, what was removed)
8. **Deprecated Components Page** (clearly marked before deletion)
9. **Responsive Behavior Guide** (Mobile/Tablet/Desktop specifications)
10. **Touch Target Audit** (All interactive elements 48px+ verified)

---

## 🧹 CLEANUP ACTIONS (Before Handoff):

```
□ Delete all duplicate components (keep ONE master)
□ Merge similar pages into single templates (use role variants)
□ Remove hidden layers (delete unused, don't hide)
□ Label all frames with clear naming convention
□ Add annotations for role-based visibility conditions
□ Document all API endpoints on relevant components
□ Create permissions matrix in Notes section
□ Add version number + change log on Cover Page
□ Test all prototype flows (ensure no broken links)
□ Export component usage report (identify unused duplicates)
□ Verify all touch targets are 48px minimum (mobile)
□ Test mobile layouts at 320px, 375px, 390px widths
□ Verify text is readable at 16px minimum on mobile
□ Check color contrast for outdoor visibility (WCAG AA)
□ Document responsive breakpoints clearly
```

---

## 💡 KISS PRINCIPLE FOR DEVELOPERS (Mobile-First):
"One component, one source of truth. Mobile-first design, scale to desktop. Role-based visibility via conditions, not duplicates. Clear naming, organized layers, documented permissions. Easy to check, easy to maintain, easy to scale."

---

## 🚀 EXPECTED OUTCOME:
After this reorganization:
- ✅ Developer opens ONE file → sees everything (Mobile/Tablet/Desktop)
- ✅ No confusion about which template to use
- ✅ No overlapping features (clear permissions matrix)
- ✅ Easy to add new features (extend existing components)
- ✅ Easy to maintain (update one component → reflects everywhere)
- ✅ Clear handoff (annotations, API notes, conditions documented)
- ✅ **Mobile-optimized** for Pakistan agents (3G, small screens, thumb-friendly)
- ✅ **Consistent experience** across all devices and roles
```