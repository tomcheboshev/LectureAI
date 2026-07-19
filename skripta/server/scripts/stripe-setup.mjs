// One-time setup script: creates the "Pro" Product and its four Prices
// (monthly / annual / student monthly / student annual) via the Stripe API,
// then configures the Billing Portal so customers can actually switch
// between them (upgrade/downgrade) and cancel/resume from the hosted
// portal — none of that works out of the box on a fresh Stripe account.
//
// Usage:
//   cd server
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
// (or just `node scripts/stripe-setup.mjs` if STRIPE_SECRET_KEY is already
// in server/.env — this script loads that file itself.)
//
// Safe to re-run: prices are looked up by lookup_key first, so a second run
// reuses what already exists instead of creating duplicates.
import "dotenv/config";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is not set. Get a test-mode key from https://dashboard.stripe.com/test/apikeys and set it in server/.env first.");
  process.exit(1);
}
if (!secretKey.startsWith("sk_test_")) {
  console.error(`Refusing to run against a non-test-mode key (starts with "${secretKey.slice(0, 8)}..."). Re-run with a sk_test_ key.`);
  process.exit(1);
}

const stripe = new Stripe(secretKey);

// Edit these to change pricing — nothing elsewhere in the codebase hardcodes
// amounts, they all come from the Price IDs this script prints out.
const PRICES = [
  { lookupKey: "pro_monthly", envVar: "STRIPE_PRICE_MONTHLY", nickname: "Pro Monthly", unitAmount: 999, interval: "month" },
  { lookupKey: "pro_annual", envVar: "STRIPE_PRICE_ANNUAL", nickname: "Pro Annual", unitAmount: 7900, interval: "year" },
  { lookupKey: "pro_monthly_student", envVar: "STRIPE_PRICE_MONTHLY_STUDENT", nickname: "Pro Monthly (Student)", unitAmount: 499, interval: "month" },
  { lookupKey: "pro_annual_student", envVar: "STRIPE_PRICE_ANNUAL_STUDENT", nickname: "Pro Annual (Student)", unitAmount: 3950, interval: "year" },
];
const CURRENCY = "usd";

// The one shared discount every personal referral Promotion Code redeems
// against (services/billing/referrals.js mints one Promotion Code per user
// pointing at this same Coupon) — the actual discount terms live in this
// one place rather than being duplicated per user.
const REFERRAL_COUPON_ID_ENV_VAR = "STRIPE_REFERRAL_COUPON_ID";
const REFERRAL_DISCOUNT_PERCENT = 10;

async function findOrCreateProduct() {
  // Stripe's Search API (products.search) has a well-documented few-second
  // indexing lag after a write — unsuitable for a script meant to be safely
  // re-runnable immediately. A plain list + filter is immediately
  // consistent and the account will only ever have a handful of products.
  const { data: existingProducts } = await stripe.products.list({ active: true, limit: 100 });
  const existing = existingProducts.find((p) => p.name === "LectureAI Pro");
  if (existing) {
    console.log(`Using existing product: ${existing.id}`);
    return existing;
  }
  const product = await stripe.products.create({
    name: "LectureAI Pro",
    description: "Unlimited study packages, larger uploads, unlimited AI Tutor chat, no watermark, priority generation queue.",
  });
  console.log(`Created product: ${product.id}`);
  return product;
}

async function findOrCreatePrice(product, spec) {
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], limit: 1 });
  if (existing.data.length > 0) {
    console.log(`  ${spec.nickname}: reusing existing price ${existing.data[0].id}`);
    return existing.data[0];
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: spec.unitAmount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    nickname: spec.nickname,
  });
  console.log(`  ${spec.nickname}: created price ${price.id} (${(spec.unitAmount / 100).toFixed(2)} ${CURRENCY.toUpperCase()}/${spec.interval})`);
  return price;
}

async function configureBillingPortal(product, prices) {
  // Without this, the hosted portal has no idea customers should be allowed
  // to switch between these prices — "Upgrade Plan"/"Downgrade Plan" would
  // otherwise be a dead end in the portal UI.
  //
  // Stripe requires every price listed for a product here to have a unique
  // billing interval, so the 4-way (monthly/annual x standard/student) set
  // can't all be listed together — two prices share "month", two share
  // "year". Only the two standard prices are portal-switchable; the student
  // prices remain Checkout-only, which is fine since student status is
  // self-attested at signup and isn't something the portal verifies anyway.
  // NOTE: student prices intentionally stay out of this list — Stripe
  // requires every price attached to one product's portal config to have a
  // UNIQUE recurring interval (a hard platform rule, not a config choice
  // here), and this product already has one "month" + one "year" price
  // (standard). Making the student prices *also* portal-switchable would
  // need a genuinely separate Stripe Product (its own monthly+annual
  // prices) — and since STRIPE_PRICE_MONTHLY_STUDENT/ANNUAL_STUDENT already
  // exist and are referenced by live subscriptions, prices can't be moved
  // to a different product after the fact. Not attempting that migration
  // here; student users keep switching plans via Checkout (re-subscribe),
  // same as today.
  const portalPrices = prices.filter((p) => p.lookup_key === "pro_monthly" || p.lookup_key === "pro_annual");
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Manage your LectureAI subscription" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [{ product: product.id, prices: portalPrices.map((p) => p.id) }],
      },
    },
  });
  console.log("Configured Billing Portal (upgrade/downgrade/cancel enabled for standard Monthly/Annual; student prices are Checkout-only).");
}

// Referral codes (services/billing/referrals.js) each mint a personal
// Promotion Code against this one shared Coupon — found by a fixed `id`
// (Stripe coupons can be given a custom id, unlike prices which only
// support lookup_key) so this script stays idempotent the same way the
// prices above are.
async function findOrCreateReferralCoupon() {
  const couponId = "lectureai-referral";
  try {
    const existing = await stripe.coupons.retrieve(couponId);
    console.log(`Referral coupon: reusing existing coupon ${existing.id}`);
    return existing;
  } catch (err) {
    if (err?.code !== "resource_missing") throw err;
  }
  const coupon = await stripe.coupons.create({
    id: couponId,
    percent_off: REFERRAL_DISCOUNT_PERCENT,
    duration: "once",
    name: "Referral discount",
  });
  console.log(`Created referral coupon: ${coupon.id} (${REFERRAL_DISCOUNT_PERCENT}% off, once)`);
  return coupon;
}

async function main() {
  console.log("Setting up Stripe products/prices for LectureAI...\n");
  const product = await findOrCreateProduct();

  console.log("\nCreating prices:");
  const prices = [];
  for (const spec of PRICES) {
    prices.push(await findOrCreatePrice(product, spec));
  }

  console.log("\nConfiguring Billing Portal...");
  await configureBillingPortal(product, prices);

  console.log("\nSetting up referral coupon...");
  const referralCoupon = await findOrCreateReferralCoupon();

  console.log("\nDone. Paste these into server/.env:\n");
  PRICES.forEach((spec, i) => console.log(`${spec.envVar}=${prices[i].id}`));
  console.log(`${REFERRAL_COUPON_ID_ENV_VAR}=${referralCoupon.id}`);

  console.log(
    "\nNext steps:\n" +
      "  1. Paste the price IDs above into server/.env.\n" +
      "  2. Run `stripe listen --forward-to localhost:3000/api/billing/webhook` (Stripe CLI) to get a\n" +
      "     webhook signing secret for local dev — paste it into STRIPE_WEBHOOK_SECRET.\n" +
      "  3. Restart the server.\n"
  );
}

main().catch((err) => {
  console.error("Stripe setup failed:", err.message);
  process.exit(1);
});
