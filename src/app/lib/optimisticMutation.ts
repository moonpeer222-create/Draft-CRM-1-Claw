/**
 * Optimistic Mutation Utility
 *
 * Wraps CRM data mutations so the UI updates immediately (optimistic),
 * then pushes to the server in the background. If the push fails,
 * it rolls back localStorage and calls the onRollback callback.
 *
 * Usage:
 *   const { mutate, isPending } = useOptimisticMutation();
 *   await mutate({
 *     storageKey: "crm_cases",
 *     apply: (current) => { ... return updated; },
 *     pushFn: () => pushCases(),
 *     onSuccess: () => loadCases(),
 *     label: "Add Payment",
 *   });
 */
import { useState, useCallback, useRef } from "react";
import { toast } from "./toast";

export interface MutationOptions {
  /** localStorage key to snapshot and potentially rollback */
  storageKey: string;
  /** Apply the mutation to the current data and return the new value.
   *  Receives the parsed current value (or null if none). */
  apply: (current: any) => any;
  /** Async function that pushes the entity to the server */
  pushFn: () => Promise<void>;
  /** Called after successful push */
  onSuccess?: () => void;
  /** Called after rollback (server push failed) */
  onRollback?: () => void;
  /** Human-readable label for error messages */
  label?: string;
  /** If true, suppress the error toast on rollback (default: false) */
  silent?: boolean;
}

export interface MutationResult {
  success: boolean;
  rolledBack: boolean;
  error?: string;
}

/**
 * Perform one optimistic mutation:
 * 1. Snapshot current localStorage value
 * 2. Apply the mutation locally
 * 3. Push to server in background
 * 4. If push fails, rollback and notify
 */
export async function optimisticMutate(opts: MutationOptions): Promise<MutationResult> {
  const { storageKey, apply, pushFn, onSuccess, onRollback, label, silent } = opts;

  // 1. Snapshot
  const snapshot = localStorage.getItem(storageKey);

  // 2. Apply locally
  try {
    const current = snapshot ? JSON.parse(snapshot) : null;
    const updated = apply(current);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch (err) {
    return { success: false, rolledBack: false, error: `Local apply failed: ${err}` };
  }

  // 3. Push to server
  try {
    await pushFn();
    onSuccess?.();
    return { success: true, rolledBack: false };
  } catch (err) {
    // 4. Rollback
    if (snapshot !== null) {
      localStorage.setItem(storageKey, snapshot);
    } else {
      localStorage.removeItem(storageKey);
    }
    onRollback?.();
    if (!silent) {
      toast.error(`${label || "Update"} failed — changes reverted. ${err}`);
    }
    return { success: false, rolledBack: true, error: String(err) };
  }
}

/**
 * React hook wrapping optimisticMutate with pending state tracking.
 */
export function useOptimisticMutation() {
  const [isPending, setIsPending] = useState(false);
  const pendingCount = useRef(0);

  const mutate = useCallback(async (opts: MutationOptions): Promise<MutationResult> => {
    pendingCount.current++;
    setIsPending(true);
    try {
      return await optimisticMutate(opts);
    } finally {
      pendingCount.current--;
      if (pendingCount.current === 0) setIsPending(false);
    }
  }, []);

  return { mutate, isPending };
}
