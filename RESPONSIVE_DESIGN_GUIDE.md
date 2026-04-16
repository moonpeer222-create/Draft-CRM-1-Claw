# Emerald Visa CRM - Responsive Design Guide

## 📐 Breakpoint System

### Tailwind CSS v4 Breakpoints
```
Mobile (Default):  0px - 639px   (iPhone SE to iPhone 15 Pro Max)
Small (sm):       640px - 767px  (Large phones, small tablets)
Medium (md):      768px - 1023px (Tablets)
Large (lg):      1024px - 1279px (Small laptops)
XLarge (xl):     1280px - 1535px (Desktops)
2XLarge (2xl):   1536px+          (Large monitors)
```

### Usage Pattern
```tsx
// Mobile-first approach
className="p-4 sm:p-6 lg:p-8"
//         ↑    ↑      ↑
//      Mobile Tablet Desktop
```

## 🎨 Layout Transformations

### 1. Navigation System

#### Mobile (<1024px)
```
┌─────────────────────────┐
│   [☰] Emerald Visa  [🔔]│ ← Header (fixed)
├─────────────────────────┤
│                         │
│   Dashboard Content     │
│   (Scrollable)          │
│                         │
│         ...             │
│                         │
├─────────────────────────┤
│ [🏠] [📁] [✓] [👤]     │ ← Bottom Nav (fixed)
└─────────────────────────┘
```

#### Desktop (≥1024px)
```
┌──────┬────────────────────────────────┐
│      │  Emerald Visa  [🔔] [👤]     │ ← Header
│  S   ├────────────────────────────────┤
│  I   │                                │
│  D   │     Dashboard Content          │
│  E   │     (Scrollable, Wide)         │
│  B   │                                │
│  A   │          ...                   │
│  R   │                                │
│      │                                │
└──────┴────────────────────────────────┘
     ↑
  Sidebar (fixed)
```

### 2. Dashboard Stats Grid

#### Mobile (Default)
```
┌───────────────────┐
│   Total Cases     │
│      142          │
└───────────────────┘
┌───────────────────┐
│  Pending Actions  │
│       28          │
└───────────────────┘
┌───────────────────┐
│  Revenue Month    │
│    PKR 450K       │
└───────────────────┘
┌───────────────────┐
│  Active Agents    │
│      15/20        │
└───────────────────┘
```

#### Tablet (md: 768px+)
```
┌───────────────────┬───────────────────┐
│   Total Cases     │  Pending Actions  │
│      142          │       28          │
└───────────────────┴───────────────────┘
┌───────────────────┬───────────────────┐
│  Revenue Month    │  Active Agents    │
│    PKR 450K       │      15/20        │
└───────────────────┴───────────────────┘
```

#### Desktop (lg: 1024px+)
```
┌────────────┬────────────┬────────────┬────────────┐
│Total Cases │Pending Act.│Rev. Month  │Active Agt. │
│    142     │     28     │  PKR 450K  │   15/20    │
└────────────┴────────────┴────────────┴────────────┘
```

### 3. Data Table → Card Transformation

#### Desktop Table View
```
╔════════╦═════════════╦══════════╦═══════════╗
║ Case ID║ Customer   ║  Status  ║   Agent   ║
╠════════╬═════════════╬══════════╬═══════════╣
║ EMR-892║ Ahmed Khan  ║ Medical  ║ Farhan    ║
║ EMR-876║ Fatima Bibi ║ Docs     ║ Ayesha    ║
║ EMR-884║ Ali Raza    ║ Payment  ║ Hassan    ║
╚════════╩═════════════╩══════════╩═══════════╝
```

#### Mobile Card View
```
┌─────────────────────────────────┐
│ Case ID: EMR-892                │
│ Customer: Ahmed Khan            │
│ Status: Medical Scheduled       │
│ Agent: Farhan                   │
│                    [View →]     │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Case ID: EMR-876                │
│ Customer: Fatima Bibi           │
│ Status: Document Collection     │
│ Agent: Ayesha                   │
│                    [View →]     │
└─────────────────────────────────┘
```

### 4. Modal Behavior

#### Desktop Modal
```
     ╔═══════════════════════════╗
     ║  Create New Case     [✕]  ║
     ╠═══════════════════════════╣
     ║ Name:     [____________]  ║
     ║ Phone:    [____________]  ║
     ║ Country:  [____________]  ║
     ║ Job Type: [____________]  ║
     ║                           ║
     ╠═══════════════════════════╣
     ║        [Cancel] [Create]  ║
     ╚═══════════════════════════╝
          ^--- Centered overlay
```

#### Mobile Modal (Full-Screen)
```
┌─────────────────────────────────┐
│ Create New Case            [✕]  │ ← Header
├─────────────────────────────────┤
│                                 │
│ Customer Name *                 │
│ [_____________________________] │
│                                 │
│ Phone Number *                  │
│ [_____________________________] │
│                                 │
│ Destination Country *           │
│ [_____________________________] │
│                                 │
│ Job Type *                      │
│ [_____________________________] │
│                                 │
│         (Scrollable)            │
│                                 │
├─────────────────────────────────┤
│     [Cancel]     [Create]       │ ← Footer
└─────────────────────────────────┘
```

## 🔘 Touch Target Specifications

### Button Sizing

#### Minimum Specifications
```
Desktop:   32px × 32px (mouse precision)
Tablet:    40px × 40px (finger friendly)
Mobile:    48px × 48px (Apple/Android standard)
```

#### Implementation Example
```tsx
// ✅ GOOD - Touch-friendly
<button className="px-4 py-3 min-h-[48px]">
  <Icon className="w-5 h-5" />
  <span>Action</span>
</button>

// ❌ BAD - Too small for touch
<button className="px-2 py-1">
  <Icon className="w-3 h-3" />
</button>
```

### Spacing Between Tap Targets
```
Minimum: 8px (gap-2)
Recommended: 12px (gap-3)
Comfortable: 16px (gap-4)
```

## 📱 Component Responsive Patterns

### 1. Responsive Typography
```tsx
// Heading
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Title
</h1>

// Body text (scales with root font-size)
<p className="text-sm md:text-base">
  Description
</p>

// Stats/Numbers
<div className="text-3xl md:text-4xl lg:text-5xl">
  142
</div>
```

### 2. Responsive Padding/Spacing
```tsx
// Container padding
<div className="p-4 sm:p-6 lg:p-8">
  Content
</div>

// Section gaps
<div className="space-y-4 sm:space-y-6 lg:space-y-8">
  <Section />
  <Section />
</div>

// Grid gaps
<div className="grid gap-4 sm:gap-6 lg:gap-8">
  <Card />
  <Card />
</div>
```

### 3. Conditional Visibility
```tsx
// Show only on mobile
<div className="lg:hidden">
  <MobileBottomNav />
</div>

// Show only on desktop
<div className="hidden lg:block">
  <Sidebar />
</div>

// Hide text on mobile, show icon only
<button>
  <Icon />
  <span className="hidden sm:inline">
    Text Label
  </span>
</button>
```

### 4. Responsive Flex/Grid
```tsx
// Stacked on mobile, row on desktop
<div className="flex flex-col lg:flex-row gap-4">
  <div>Left</div>
  <div>Right</div>
</div>

// 1 column → 2 columns → 4 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <Card />
  <Card />
  <Card />
  <Card />
</div>
```

## 🎯 Action Button Patterns

### Primary Action Button
```tsx
// Mobile: Full width or icon + text
// Desktop: Auto width with icon + full text
<button className="
  w-full sm:w-auto
  px-6 py-3 min-h-[48px]
  bg-emerald-600 text-white
  rounded-xl
  flex items-center justify-center gap-2
">
  <Plus className="w-5 h-5" />
  <span>Create New Case</span>
</button>
```

### Secondary Actions Grid
```tsx
// 2 columns on mobile, flex row on desktop
<div className="grid grid-cols-2 lg:flex gap-3">
  <button className="min-h-[48px]">
    <Icon />
    <span className="hidden lg:inline">Action 1</span>
  </button>
  <button className="min-h-[48px]">
    <Icon />
    <span className="hidden lg:inline">Action 2</span>
  </button>
</div>
```

## 🎨 Visual Hierarchy

### Mobile Priorities
```
1. Primary navigation (bottom bar)
2. Current page title
3. Critical actions (floating action button)
4. Key metrics/stats
5. Primary content
6. Secondary content
7. Tertiary actions
```

### Desktop Priorities
```
1. Sidebar navigation (always visible)
2. Header with breadcrumbs
3. Action toolbar
4. Content area (multi-column)
5. Sidebar panels (if applicable)
```

## 📊 Dashboard Layout Examples

### Admin Dashboard Mobile
```
┌─────────────────────────┐
│ [☰] Emerald  [🔔] [👤] │ ← Sticky header
├─────────────────────────┤
│ 🟢 Live Sync Active     │ ← Status banner
├─────────────────────────┤
│ [+ New Case] [🔔]      │ ← Quick actions (2-col grid)
│ [📊 Report]  [📅]      │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │  Total Cases: 142   │ │ ← Stats cards
│ └─────────────────────┘ │   (stacked)
│ ┌─────────────────────┐ │
│ │  Pending: 28        │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│  Recent Activity        │ ← Scrollable
│  ┌─────────────────┐   │   lists
│  │ • Case updated  │   │
│  └─────────────────┘   │
│  ┌─────────────────┐   │
│  │ • Payment rcvd  │   │
│  └─────────────────┘   │
├─────────────────────────┤
│ [🏠] [📁] [✓] [👤]     │ ← Bottom nav (fixed)
└─────────────────────────┘
```

### Admin Dashboard Desktop
```
┌──────────┬─────────────────────────────────────────────┐
│          │ Emerald Visa    [Live🟢] [🔔] [👤] [Logout]│
│  ADMIN   ├─────────────────────────────────────────────┤
│  SIDEBAR │ [+New] [📊] [📋] [📅]                       │
│          ├─────────────────────────────────────────────┤
│ Dashboard│ ┌────┬────┬────┬────┐                       │
│ Reports  │ │142 │ 28 │450K│15  │ ← Stats (4-col)      │
│ Team     │ └────┴────┴────┴────┘                       │
│ Cases    │ ┌─────────────┬────────────┐                │
│ Settings │ │  Activity   │  Deadlines │ ← 2-col layout│
│ ...      │ │  Feed       │            │                │
│          │ └─────────────┴────────────┘                │
│          │ ┌──────────────────────────┐                │
│          │ │  Upcoming Appointments   │ ← Full table  │
│          │ │  [Table with all cols]   │                │
│          │ └──────────────────────────┘                │
└──────────┴─────────────────────────────────────────────┘
```

## 🔄 Transition Zones

### 640px - 767px (sm breakpoint)
- Bottom nav still visible
- 2-column grids start appearing
- Slightly increased padding
- Medium-sized typography

### 768px - 1023px (md breakpoint)
- Transition from mobile to tablet layouts
- Bottom nav fades, hamburger remains
- 2-3 column grids
- Sidebar can be collapsible

### 1024px+ (lg breakpoint)
- Full desktop experience
- Bottom nav hidden completely
- Persistent sidebar
- Multi-column layouts
- Hover states active

## ⚡ Performance Considerations

### Mobile Optimization
```tsx
// Lazy load images
<img loading="lazy" src="..." />

// Conditional rendering for expensive components
{isDesktop && <ExpensiveChart />}

// Use CSS over JS for responsive behavior
className="hidden lg:block" // ✅ GOOD
{screenWidth >= 1024 && <Component />} // ❌ AVOID
```

### Animation Performance
```tsx
// GPU-accelerated properties
transform: translateX() ✅
opacity: 0-1 ✅
left: 0-100px ❌ (causes reflow)
```

## 🎯 Testing Devices

### Minimum Test Matrix
```
Mobile:
- iPhone SE (375×667)
- iPhone 15 Pro (390×844)
- Samsung Galaxy S21 (360×800)

Tablet:
- iPad Mini (768×1024)
- iPad Air (820×1180)

Desktop:
- MacBook Pro 13" (1440×900)
- Desktop 1080p (1920×1080)
- Desktop 4K (3840×2160)
```

### Browser Testing
```
✅ Chrome (latest)
✅ Safari (latest)
✅ Firefox (latest)
✅ Edge (latest)
```

## 📝 Code Snippets

### Complete Responsive Page Template
```tsx
export function ResponsivePage() {
  const { darkMode } = useTheme();
  
  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>
      
      {/* Main Content */}
      <main className="flex-1">
        {/* Header */}
        <header className="sticky top-0 z-50">
          <Header />
        </header>
        
        {/* Content Area with mobile bottom padding */}
        <div className="p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          {/* Responsive grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card />
            <Card />
            <Card />
            <Card />
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <MobileBottomNav role="admin" />
      </div>
    </div>
  );
}
```

---

**Last Updated:** March 1, 2026  
**Version:** 1.0.0  
**Responsive Framework:** Tailwind CSS v4 + React 18.3.1
