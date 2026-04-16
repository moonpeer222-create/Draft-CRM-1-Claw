/**
 * useCrossTabRefresh — listens for cross-tab entity updates
 * via the BroadcastChannel "crm-cross-tab-update" custom event
 * and calls the refresh callback when a relevant entity changes.
 *
 * Usage:
 *   useCrossTabRefresh(["cases", "notifications"], () => loadCases());
 */
import { useEffect, useRef } from "react";

export function useCrossTabRefresh(
  /** Entity keys to listen for (e.g. "cases", "users", "notifications") */
  entities: string[],
  /** Callback fired when a relevant entity is updated in another tab */
  onRefresh: () => void,
  /** Debounce window in ms to batch rapid updates (default: 300ms) */
  debounceMs = 300,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    const entitySet = new Set(entities);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.entityKey) return;
      if (!entitySet.has(detail.entityKey)) return;

      // Debounce: if multiple entities fire within the window, batch into one refresh
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current();
      }, debounceMs);
    };

    window.addEventListener("crm-cross-tab-update", handler);
    return () => {
      window.removeEventListener("crm-cross-tab-update", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [entities.join(","), debounceMs]);
}
