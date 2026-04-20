import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { canProceedToCheckout } from "../../../utils/pricing";
import type { Cart } from "../../../hooks/useCart";

// ── canProceedToCheckout ──────────────────────────────────────────────────────

function makeEmptyCart(tip = 0): Cart {
  return { items: [], subtotal: 0, tax: 0, tip, total: tip };
}

function makeNonEmptyCart(): Cart {
  return {
    items: [
      {
        menuItemId: "item-1",
        name: "Matcha Latte",
        quantity: 1,
        selectedCustomizations: {},
        unitPrice: 500,
      },
    ],
    subtotal: 500,
    tax: 44,
    tip: 0,
    total: 544,
  };
}

describe("canProceedToCheckout", () => {
  it("returns false for an empty cart", () => {
    expect(canProceedToCheckout(makeEmptyCart())).toBe(false);
  });

  it("returns false for an empty cart with a tip set", () => {
    expect(canProceedToCheckout(makeEmptyCart(200))).toBe(false);
  });

  it("returns true for a cart with at least one item", () => {
    expect(canProceedToCheckout(makeNonEmptyCart())).toBe(true);
  });

  it("returns true for a cart with multiple items", () => {
    const cart: Cart = {
      items: [
        { menuItemId: "a", name: "A", quantity: 2, selectedCustomizations: {}, unitPrice: 300 },
        { menuItemId: "b", name: "B", quantity: 1, selectedCustomizations: {}, unitPrice: 500 },
      ],
      subtotal: 1100,
      tax: 96,
      tip: 0,
      total: 1196,
    };
    expect(canProceedToCheckout(cart)).toBe(true);
  });
});

// ── CheckoutPage redirect behaviour ──────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseCart = vi.fn();
vi.mock("../../../hooks/useCart", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks/useCart")>();
  return {
    ...actual,
    useCart: () => mockUseCart(),
  };
});

describe("CheckoutPage redirect", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("redirects to /menu when cart is empty", async () => {
    mockUseCart.mockReturnValue({
      cart: makeEmptyCart(),
      setTip: vi.fn(),
    });

    const { CheckoutPage } = await import("../CheckoutPage");
    render(<CheckoutPage />);

    expect(mockNavigate).toHaveBeenCalledWith("/menu", { replace: true });
  });

  it("does not redirect when cart has items", async () => {
    mockUseCart.mockReturnValue({
      cart: makeNonEmptyCart(),
      setTip: vi.fn(),
    });

    const { CheckoutPage } = await import("../CheckoutPage");
    render(<CheckoutPage />);

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
