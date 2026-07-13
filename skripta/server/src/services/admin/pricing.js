import { getStripe } from "../billing/stripe.js";

// Stripe stays the single source of truth for pricing (matches
// scripts/stripe-setup.mjs's own convention) rather than re-hardcoding
// amounts here — but retrieving a Price on every MRR calculation would be
// wasteful, so cache each lookup for a few minutes.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // priceId -> { monthlyAmount, expiresAt }

// Returns the monthly-equivalent amount (in cents) for a Stripe price —
// annual prices are divided by 12 so mixed monthly/annual subscribers can
// be summed into one MRR figure.
export async function monthlyEquivalentAmount(priceId) {
  if (!priceId) return 0;

  const cached = cache.get(priceId);
  if (cached && cached.expiresAt > Date.now()) return cached.monthlyAmount;

  const stripe = getStripe();
  const price = await stripe.prices.retrieve(priceId);
  const amount = price.unit_amount || 0;
  const interval = price.recurring?.interval;
  const monthlyAmount = interval === "year" ? amount / 12 : amount;

  cache.set(priceId, { monthlyAmount, expiresAt: Date.now() + CACHE_TTL_MS });
  return monthlyAmount;
}
