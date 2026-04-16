# 🚨 Nuclear Panic Mode - Cross-Device Kill Switch

## Overview

The Nuclear Panic Mode is a cross-device stealth security feature that allows the admin to instantly kill ALL CRM sessions across ALL devices worldwide with a single button press.

## Architecture

### Three-Layer Kill System

1. **BroadcastChannel (Same-Device Instant Kill)**
   - Response time: < 100ms
   - Kills all tabs on the SAME device instantly
   - Works across Admin, Agent, and Customer portals

2. **Server Polling (Cross-Device Kill)**
   - Response time: < 3 seconds
   - Checks Supabase KV every 3 seconds
   - Detects server panic flag and self-destructs
   - Works across ALL devices worldwide

3. **LocalStorage Fallback**
   - For browsers without BroadcastChannel support
   - Uses storage events to sync across tabs

## How It Works

### Trigger Flow

1. **Admin clicks "Quick Switch" button** in the Admin Sidebar (Ctrl+Shift+H to reveal)
2. **Server flag is set** in Supabase KV: `crm:panic_mode = { active: true, timestamp }`
3. **BroadcastChannel message sent** to all tabs on the same device
4. **Current tab self-destructs** immediately

### Listener Flow (Protected Routes)

1. **All protected routes** (dashboard, cases, etc.) initialize panic listener on mount
2. **Three detection methods run simultaneously:**
   - BroadcastChannel listener (instant)
   - LocalStorage event listener (fallback)
   - Server polling every 3 seconds (cross-device)
3. **On panic detection:**
   - Wipe ONLY auth/session keys (CRM data preserved)
   - Clear sessionStorage
   - Clear cookies
   - Replace browser history with random decoy URL
   - Blank the page
   - Attempt to close the tab
   - Redirect to decoy URL

### Safe Route Flow (Login Pages)

1. **Login pages are SAFE ROUTES** - panic listener does NOT activate
2. **On mount, login pages clear the server panic flag**
3. **User can access login pages to disable panic**
4. **No deadlock - system recovers cleanly**

## Safe Routes

The following routes will NOT self-destruct and will clear the panic flag:

- `/` (Landing page)
- `/admin/login`
- `/agent/login`
- `/customer/login`

## What Gets Wiped vs Preserved

### ✅ PRESERVED (Data Stays)
- Cases data
- Agent profiles
- Admin profile
- Customer data
- Access codes
- All CRM business data

### ❌ WIPED (Session Only)
- `emerald-admin-auth`
- `emerald-agent-session`
- `emerald-customer-session`
- All sessionStorage
- All cookies
- Browser history

## Decoy URLs

When panic mode triggers, the tab is redirected to a random innocent URL:

- Google Search (weather, restaurants, news, etc.)
- Gmail
- Google Maps
- Google Calendar
- Google Drive
- YouTube

## Server Endpoints

### POST `/api/panic/trigger`
Sets the server panic flag.

**Request:**
```json
POST /make-server-5cdc87b7/api/panic/trigger
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "timestamp": 1709280000000
}
```

### GET `/api/panic/status`
Checks if panic mode is active.

**Request:**
```json
GET /make-server-5cdc87b7/api/panic/status
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true,
  "active": true,
  "timestamp": 1709280000000
}
```

### POST `/api/panic/clear`
Clears the server panic flag (called by login pages).

**Request:**
```json
POST /make-server-5cdc87b7/api/panic/clear
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "success": true
}
```

## Recovery Process

1. **Panic is triggered** → All devices killed within 3 seconds
2. **User opens any CRM login page** → Server flag is automatically cleared
3. **User logs in normally** → All CRM data is intact
4. **System works normally** → No data loss

## Testing

### Test Scenario 1: Same-Device Kill
1. Open CRM in multiple tabs (Admin, Agent, Customer)
2. Trigger panic from Admin sidebar
3. **Expected:** All tabs killed instantly (< 100ms)

### Test Scenario 2: Cross-Device Kill
1. Open CRM on Device A (protected route)
2. Open CRM on Device B (protected route)
3. Trigger panic from Device A
4. **Expected:** Device B killed within 3 seconds

### Test Scenario 3: Recovery
1. Trigger panic
2. Wait for all tabs to close/redirect
3. Open `/admin/login` page
4. **Expected:** Server panic flag cleared, can log in normally

### Test Scenario 4: Safe Route Protection
1. Open `/admin/login` page
2. Trigger panic from another device
3. **Expected:** Login page stays active, clears server flag

## Implementation Files

### Backend
- `/supabase/functions/server/index.tsx` - Server routes for panic management

### Frontend
- `/src/app/lib/panicMode.ts` - Core panic mode logic
- `/src/app/components/RootLayout.tsx` - Panic listener initialization
- `/src/app/components/AdminSidebar.tsx` - Panic trigger button
- `/src/app/pages/admin/AdminLogin.tsx` - Server flag clearing
- `/src/app/pages/agent/AgentLogin.tsx` - Server flag clearing
- `/src/app/pages/customer/CustomerLogin.tsx` - Server flag clearing

## Security Notes

1. **No data loss** - Only auth/session data is wiped, all business data preserved
2. **Clean recovery** - Login pages automatically clear panic flag
3. **No deadlock** - Safe routes prevent infinite panic loops
4. **Cross-device** - Works across all devices worldwide via server polling
5. **Instant local** - Same-device tabs killed in < 100ms via BroadcastChannel
6. **Browser history replaced** - No back button to CRM pages
7. **Tab closes** - Attempts to close tab (works if opened by script)
8. **Decoy redirect** - Falls back to innocent URL if tab can't close

## Keyboard Shortcuts

- **Ctrl+Shift+H** - Toggle Admin Tools panel (reveals panic button)
- **Direct click** - Click "Quick Switch" button in Admin Tools panel

## Visual Indicators

- Red gradient background
- Animated scan line effect
- Pulsing lightning bolt icon
- "Closes CRM, erases history, opens decoy" description
- Keyboard shortcut hint: "Ctrl+Shift+H"

## Developer Notes

### Adding New Safe Routes

Edit `/src/app/lib/panicMode.ts`:

```typescript
export const SAFE_ROUTES = [
  '/admin/login',
  '/agent/login',
  '/customer/login',
  '/',
  '/your-new-safe-route', // Add here
];
```

### Customizing Decoy URLs

Edit the `decoyPages` array in `/src/app/lib/panicMode.ts`:

```typescript
const decoyPages = [
  { url: "https://...", title: "..." },
  // Add more decoy URLs here
];
```

### Adjusting Polling Interval

Edit the polling interval in `/src/app/lib/panicMode.ts`:

```typescript
const pollInterval = setInterval(async () => {
  // ...
}, 3000); // Change this value (milliseconds)
```

## Console Logs

The system logs key events to the console for debugging:

- `🛡️ Safe route - panic listener NOT activated` - Login page loaded
- `🚨 Protected route - panic listener activated` - Dashboard/protected page loaded
- `🚨 PANIC MODE TRIGGERED at [timestamp]` - Server: Panic triggered
- `✅ PANIC MODE CLEARED at [timestamp]` - Server: Panic cleared
- `🚨 Server panic flag set` - Client: Server flag set successfully
- `✅ Server panic flag cleared` - Client: Server flag cleared successfully

## Troubleshooting

### Issue: Panic doesn't trigger on other devices
**Solution:** Check server polling is running (should see network requests every 3s to `/api/panic/status`)

### Issue: Login page also gets killed
**Solution:** Verify login route is in `SAFE_ROUTES` array and `clearServerPanic()` is called in `useEffect`

### Issue: Panic triggers but data is lost
**Solution:** Check `AUTH_KEYS_TO_WIPE` array - should only contain session keys, not data keys

### Issue: Can't recover after panic
**Solution:** Open any login page - it will automatically clear the server flag

## Production Deployment

1. **Test thoroughly** on staging environment
2. **Document** for all admin users
3. **Train** admins on proper usage
4. **Monitor** server logs for panic events
5. **Regular drills** to ensure system works

## Legal & Compliance

This system is designed for:
- Emergency security situations
- Privacy protection
- Compliance with data protection requirements

**Not** designed for:
- Regular logout (use normal logout instead)
- Data deletion (data is preserved)
- Hiding evidence of wrongdoing (consult legal counsel)

## Version History

- **v1.0** - Initial implementation with BroadcastChannel only
- **v2.0** - Added server-side cross-device support (current)

---

**Last Updated:** March 1, 2026
**Maintainer:** Emerald Visa CRM Development Team
