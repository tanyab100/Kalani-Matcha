import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Use vi.hoisted so these variables are available inside vi.mock factory functions
const { mockConfirmPayment, mockStripe, mockElements } = vi.hoisted(() => {
  const mockConfirmPayment = vi.fn();
  const mockStripe = { confirmPayment: mockConfirmPayment };
  const mockElements = {};
  return { mockConfirmPayment, mockStripe, mockElements };
});

// Mock @stripe/react-stripe-js so we control useStripe / useElements
// and render PaymentElement as a simple div for testing.
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => mockStripe,
  useElements: () => mockElements,
}));

// Mock payment.ts so getStripe() doesn't try to load the real Stripe.js
vi.mock("../../../services/payment", () => ({
  getStripe: () => Promise.resolve(mockStripe),
}));

// Import after mocks are set up
import { PaymentForm } from "../PaymentForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPaymentForm(
  onSuccess = vi.fn(),
  onError = vi.fn(),
) {
  return render(
    <PaymentForm
      clientSecret="pi_test_secret_123"
      onSuccess={onSuccess}
      onError={onError}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe("loading state during payment processing", () => {
  it("shows 'Processing…' and disables the submit button while payment is in flight", async () => {
    // Never resolves — simulates in-flight request
    mockConfirmPayment.mockReturnValue(new Promise(() => {}));

    renderPaymentForm();

    const button = screen.getByRole("button", { name: /pay now/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
    });
  });

  it("re-enables the submit button after payment resolves", async () => {
    mockConfirmPayment.mockResolvedValue({
      paymentIntent: { id: "pi_123", status: "succeeded" },
    });

    renderPaymentForm();

    const button = screen.getByRole("button", { name: /pay now/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay now/i })).not.toBeDisabled();
    });
  });
});

// ── Payment intent creation failure (Req 6.3) ────────────────────────────────

describe("payment intent creation failure", () => {
  it("displays the Stripe error message when confirmPayment returns an error", async () => {
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Your card was declined.");
    });
  });

  it("does NOT call onSuccess when confirmPayment returns an error", async () => {
    const onSuccess = vi.fn();
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Insufficient funds." },
    });

    renderPaymentForm(onSuccess);

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onError with the Stripe error message", async () => {
    const onError = vi.fn();
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });

    renderPaymentForm(vi.fn(), onError);

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Your card was declined.");
    });
  });

  it("shows a fallback message when Stripe error has no message", async () => {
    mockConfirmPayment.mockResolvedValue({ error: {} });

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /payment failed/i,
      );
    });
  });
});

// ── Network timeout / unexpected error (Req 6.3) ─────────────────────────────

describe("network timeout and unexpected errors", () => {
  it("displays an error message when confirmPayment throws a network error", async () => {
    mockConfirmPayment.mockRejectedValue(new Error("Network request failed"));

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network request failed");
    });
  });

  it("does NOT call onSuccess on network error — cart is preserved", async () => {
    const onSuccess = vi.fn();
    mockConfirmPayment.mockRejectedValue(new Error("Network request failed"));

    renderPaymentForm(onSuccess);

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onError (not onSuccess) on network error, signalling cart preservation", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    mockConfirmPayment.mockRejectedValue(new Error("Network request failed"));

    renderPaymentForm(onSuccess, onError);

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("Network request failed");
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a fallback message when the thrown error has no message", async () => {
    mockConfirmPayment.mockRejectedValue({});

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /network error/i,
      );
    });
  });
});

// ── Retry behavior ────────────────────────────────────────────────────────────

describe("retry behavior after payment failure", () => {
  it("re-enables the submit button after a card-declined error so the user can retry", async () => {
    mockConfirmPayment.mockResolvedValue({
      error: { message: "Your card was declined." },
    });

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Button should be interactive again (not stuck in loading state)
    expect(screen.getByRole("button", { name: /pay now/i })).not.toBeDisabled();
  });

  it("re-enables the submit button after a network error so the user can retry", async () => {
    mockConfirmPayment.mockRejectedValue(new Error("Network request failed"));

    renderPaymentForm();

    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /pay now/i })).not.toBeDisabled();
  });

  it("allows a second payment attempt after the first fails", async () => {
    const onSuccess = vi.fn();

    // First attempt fails
    mockConfirmPayment.mockResolvedValueOnce({
      error: { message: "Your card was declined." },
    });
    // Second attempt succeeds
    mockConfirmPayment.mockResolvedValueOnce({
      paymentIntent: { id: "pi_456", status: "succeeded" },
    });

    renderPaymentForm(onSuccess);

    // First attempt
    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Retry
    await userEvent.click(screen.getByRole("button", { name: /pay now/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("pi_456");
    });
  });
});
