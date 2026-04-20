import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

if (!publishableKey) {
  console.warn(
    "VITE_STRIPE_PUBLISHABLE_KEY is not set. Payment features will not work."
  );
}

// Singleton promise — Stripe.js is loaded once and reused
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey ?? "");
  }
  return stripePromise;
}
