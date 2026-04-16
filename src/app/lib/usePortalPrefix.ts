/**
 * usePortalPrefix — Returns the URL prefix for the current portal role.
 *
 * When admin page components are reused under /master/, this hook
 * ensures navigate() calls stay within the correct portal context
 * instead of hardcoding "/admin".
 *
 * Usage:
 *   const prefix = usePortalPrefix();        // "/admin" or "/master"
 *   navigate(`${prefix}/cases/${caseId}`);
 */
import { useLocation } from "react-router";

export function usePortalPrefix(): string {
  const { pathname } = useLocation();
  if (pathname.startsWith("/master")) return "/master";
  if (pathname.startsWith("/agent")) return "/agent";
  if (pathname.startsWith("/customer")) return "/customer";
  if (pathname.startsWith("/operator")) return "/operator";
  return "/admin";
}
