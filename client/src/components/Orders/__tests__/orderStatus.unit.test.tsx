/**
 * Unit tests for order status rendering and refresh flow.
 * Requirements: 7.2, 7.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrderStatusPage } from "../OrderStatusPage";
import type { Order } from "../OrderConfirmation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "abc12345-0000-0000-0000-000000000000",
    customerId: null,
    items: [
      {
        menuItemId: "item-1",
        name: "Matcha Latte",
        quantity: 2,
        selectedCustomizations: { milk: "oat" },
        unitPrice: 550,
      },
    ],
    subtotal: 1100,
    tax: 99,
    tip: 0,
    total: 1199,
    pickupSlotId: "slot-1",
    pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: "received",
    paymentMethod: "card",
    createdAt: new Date().toISOString(),
    idempotencyKey: "idem-key-1",
    ...overrides,
  };
}

function renderPage(orderId: string, token = "test-token-abc") {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}?token=${token}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderStatusPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Mock api module ───────────────────────────────────────────────────────────

vi.mock("../../../services/api", () => ({
  getOrder: vi.fn(),
}));

import { getOrder } from "../../../services/api";
const mockGetOrder = vi.mocked(getOrder);

beforeEach(() => {
  vi.useFakeTimers();
  mockGetOrder.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Status label rendering (Requirements: 7.3) ────────────────────────────────

describe("OrderStatusPage — status label rendering", () => {
  const statuses: Array<{ status: Order["status"]; label: string }> = [
    { status: "pending_payment", label: "Pending Payment" },
    { status: "received", label: "Received" },
    { status: "preparing", label: "Preparing" },
    { status: "ready", label: "Ready for Pickup" },
  ];

  for (const { status, label } of statuses) {
    it(`renders "${label}" for status "${status}"`, async () => {
      const order = makeOrder({
        status,
        paymentMethod: status === "pending_payment" ? "venmo" : "card",
      });
      mockGetOrder.mockResolvedValueOnce(order);

      await act(async () => {
        renderPage(order.id);
      });

      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  }
});

// ── Order details rendered (Requirements: 7.2) ───────────────────────────────

describe("OrderStatusPage — order details", () => {
  it("displays the order number (last 8 chars of id, uppercased)", async () => {
    const order = makeOrder();
    mockGetOrder.mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    expect(screen.getByText(`#${order.id.slice(-8).toUpperCase()}`)).toBeTruthy();
  });

  it("displays the pickup time", async () => {
    const order = makeOrder();
    mockGetOrder.mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    // The pickup time section heading should be present
    expect(screen.getByText("Pickup Time")).toBeTruthy();
  });
});

// ── Venmo shows pending_payment step (Requirements: 7.3) ─────────────────────

describe("OrderStatusPage — Venmo order shows pending_payment step", () => {
  it("shows Pending Payment step for venmo orders", async () => {
    const order = makeOrder({ status: "pending_payment", paymentMethod: "venmo" });
    mockGetOrder.mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    expect(screen.getAllByText("Pending Payment").length).toBeGreaterThan(0);
  });

  it("does not show Pending Payment step for card orders", async () => {
    const order = makeOrder({ status: "received", paymentMethod: "card" });
    mockGetOrder.mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    expect(screen.queryByText("Pending Payment")).toBeNull();
  });
});

// ── Loading and error states ──────────────────────────────────────────────────

describe("OrderStatusPage — loading and error states", () => {
  it("shows loading text before order resolves", async () => {
    // Never resolves during this test
    mockGetOrder.mockReturnValue(new Promise(() => {}));
    const orderId = "some-id";

    render(
      <MemoryRouter initialEntries={[`/orders/${orderId}?token=test-token`]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderStatusPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading order status/i)).toBeTruthy();
  });

  it("shows error message when fetch fails and no order is cached", async () => {
    mockGetOrder.mockRejectedValueOnce(new Error("Network error"));
    // Prevent retry timer from firing
    mockGetOrder.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      renderPage("bad-id");
    });

    expect(screen.getByText(/network error/i)).toBeTruthy();
  });

  it("shows missing-token message when no token is in the URL", () => {
    render(
      <MemoryRouter initialEntries={["/orders/no-token-id"]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderStatusPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/access token missing/i)).toBeTruthy();
    // getOrder should never be called without a token
    expect(mockGetOrder).not.toHaveBeenCalled();
  });
});

// ── Status polling / refresh (Requirements: 7.2) ─────────────────────────────

describe("OrderStatusPage — status polling", () => {
  it("polls again after 5 seconds and updates status", async () => {
    const order1 = makeOrder({ status: "received" });
    const order2 = makeOrder({ status: "preparing" });

    mockGetOrder
      .mockResolvedValueOnce(order1)
      .mockResolvedValueOnce(order2);

    await act(async () => {
      renderPage(order1.id);
    });

    // Initial render shows "received"
    expect(screen.getAllByText("Received").length).toBeGreaterThan(0);

    // Advance timer to trigger next poll
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByText("Preparing").length).toBeGreaterThan(0);
    expect(mockGetOrder).toHaveBeenCalledTimes(2);
  });

  it("stops polling when order reaches 'ready' status", async () => {
    const order = makeOrder({ status: "ready" });
    mockGetOrder.mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    expect(screen.getAllByText("Ready for Pickup").length).toBeGreaterThan(0);

    // Advance well past poll interval — should NOT call getOrder again
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(mockGetOrder).toHaveBeenCalledTimes(1);
  });

  it("retries polling after a fetch error", async () => {
    const order = makeOrder({ status: "received" });
    mockGetOrder
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(order);

    await act(async () => {
      renderPage(order.id);
    });

    // First call failed — advance timer to trigger retry
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockGetOrder).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("Received").length).toBeGreaterThan(0);
  });
});
