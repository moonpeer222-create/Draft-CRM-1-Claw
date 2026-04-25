import { toast } from "./toast";
import { pushAdminProfile } from "./syncService";

export const PROFILE_KEY = "crm_admin_profile";

export interface AdminProfileData {
  fullName: string;
  name?: string; // alias for fullName (backward compat)
  urduName?: string; // Add support for Urdu name
  email: string;
  phone: string;
  role: string;
  avatar?: string;
  joinDate: string;
  lastLogin: string;
  loginCount: number;
  notifications: {
    email: boolean;
    browser: boolean;
    marketing: boolean;
  };
}

// Event to notify components of profile updates
const PROFILE_UPDATE_EVENT = "crm_admin_profile_updated";

export function getAdminProfile(): AdminProfileData {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure urduName exists if it's an old profile
      if (!parsed.urduName) {
        parsed.urduName = "عبداللہ خان";
      }
      return parsed;
    } catch {
      // Fallback if parse fails
    }
  }
  
  // Default profile — populated from active session if available
  const defaultProfile: AdminProfileData = {
    fullName: "Admin",
    urduName: "ایڈمن",
    email: "admin@emeraldvisa.com",
    phone: "",
    role: "Administrator",
    joinDate: new Date().toISOString().split("T")[0],
    lastLogin: new Date().toISOString(),
    loginCount: 1,
    notifications: {
      email: true,
      browser: true,
      marketing: false,
    },
  };

  // Try to populate from the active admin session
  try {
    const sessionRaw = localStorage.getItem("emerald-admin-auth");
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      if (session.fullName) defaultProfile.fullName = session.fullName;
      if (session.email) defaultProfile.email = session.email;
    }
  } catch { /* ignore */ }
  
  localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile));
  return defaultProfile;
}

export function saveAdminProfile(profile: AdminProfileData) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  
  // Dispatch event for local components
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATE_EVENT, { detail: profile }));
  
  // Sync with server
  pushAdminProfile();
}

export function subscribeToProfileUpdates(callback: (profile: AdminProfileData) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<AdminProfileData>;
    callback(customEvent.detail);
  };
  
  window.addEventListener(PROFILE_UPDATE_EVENT, handler);
  return () => window.removeEventListener(PROFILE_UPDATE_EVENT, handler);
}