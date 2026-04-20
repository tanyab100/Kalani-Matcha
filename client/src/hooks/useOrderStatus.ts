import { useEffect, useRef, useState } from "react";
import { getOrder } from "../services/api";
import type { Order } from "../components/Orders/OrderConfirmation";

// Poll interval in ms. Stops polling once order reaches a terminal status.
const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES: Order["status"][] = ["ready"];

export interface UseOrderStatusResult {
  order: Order | null;
  loading: boolean;
  error: string | null;
}

/**
 * Polls GET /orders/:id every POLL_INTERVAL_MS until the order reaches
 * a terminal status ("ready") or the component unmounts.
 *
 * Unmount safety: a single `cancelled` flag is set in the effect cleanup.
 * Every async callback and scheduled timer checks this flag before touching
 * React state or scheduling the next poll, so no state updates occur after
 * unmount regardless of in-flight fetch timing.
 *
 * Requirements: 7.2
 */
export function useOrderStatus(orderId: string | null, accessToken: string | null): UseOrderStatusResult {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orderId || !accessToken) return;

    let cancelled = false;

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function fetchOrder() {
      if (cancelled) return;
      setLoading(true);
      try {
        const fetched = await getOrder(orderId!, accessToken!);
        if (cancelled) return;
        setOrder(fetched);
        setError(null);
        if (!TERMINAL_STATUSES.includes(fetched.status)) {
          timerRef.current = setTimeout(fetchOrder, POLL_INTERVAL_MS);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load order status");
        // Retry on error — the order may just be temporarily unreachable
        timerRef.current = setTimeout(fetchOrder, POLL_INTERVAL_MS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOrder();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [orderId, accessToken]);

  return { order, loading, error };
}
