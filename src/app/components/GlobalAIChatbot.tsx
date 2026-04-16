/**
 * GlobalAIChatbot — renders a floating AI chatbot on every portal.
 * Auto-detects the current role from the URL path and renders the
 * appropriate RoleBasedChatbot or OperatorChatbot.
 *
 * Skips rendering on:
 *  - Login pages (any path containing "/login")
 *  - Root "/" or unknown routes
 *  - Pages that already embed their own chatbot (detected via data attribute)
 *
 * This replaces the per-page manual embedding pattern so AI is always available.
 */
import { useLocation } from "react-router";
import { RoleBasedChatbot } from "./visaverse/RoleBasedChatbot";
import { OperatorChatbot } from "./OperatorChatbot";

type PortalRole = "admin" | "agent" | "customer" | "master_admin" | "operator" | null;

function detectRole(pathname: string): PortalRole {
  if (pathname.startsWith("/master")) return "master_admin";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/agent")) return "agent";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/operator")) return "operator";
  return null;
}

export function GlobalAIChatbot() {
  const { pathname } = useLocation();

  // Don't render on login/signup pages or root
  if (
    pathname === "/" ||
    pathname.includes("/login") ||
    pathname.includes("/signup") ||
    pathname.includes("/register") ||
    pathname.includes("/ai-chatbot")  // Dedicated AI chatbot pages render their own
  ) {
    return null;
  }

  const role = detectRole(pathname);
  if (!role) return null;

  // Operator has its own specialized chatbot with Urdu-only + CRM actions
  if (role === "operator") {
    return <OperatorChatbot />;
  }

  // All other roles use the generic RoleBasedChatbot
  return <RoleBasedChatbot role={role} />;
}