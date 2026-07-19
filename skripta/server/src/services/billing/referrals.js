import User from "../../models/User.js";
import { getStripe } from "./stripe.js";

// The referral "code" IS the Stripe Promotion Code's own `code` string —
// there's deliberately no separate internal code, so there's only ever one
// place (Stripe) that decides whether a code is valid/redeemed.
const REFERRAL_COUPON_ID = () => process.env.STRIPE_REFERRAL_COUPON_ID;

function randomCode() {
  // 8 unambiguous uppercase alnum chars (no 0/O/1/I) — short enough to say
  // out loud, long enough that collisions are essentially impossible.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Mints a personal Promotion Code for this user against the shared referral
// Coupon (set up once by scripts/stripe-setup.mjs), idempotently — a second
// call just returns the same code already on file. No referrer-side reward
// is tracked here beyond a redemption counter, per the locked "friend
// discount only" decision.
export async function ensureReferralCode(user) {
  if (user.referralCode && user.referralPromotionCodeId) {
    return { code: user.referralCode, shareUrl: shareUrlFor(user.referralCode) };
  }
  const couponId = REFERRAL_COUPON_ID();
  if (!couponId) {
    throw Object.assign(new Error("Referrals are not configured yet (STRIPE_REFERRAL_COUPON_ID is not set)."), { userFacing: true, status: 500 });
  }
  const stripe = getStripe();

  // A handful of attempts covers the astronomically unlikely case of a
  // collision against another user's code (checked in Mongo first, cheap)
  // or Stripe's own global code namespace (checked by letting the create
  // call itself fail and retrying, since Stripe has no separate "does this
  // code exist" lookup by code string).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const collision = await User.exists({ referralCode: code });
    if (collision) continue;
    try {
      const promotionCode = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: couponId },
        code,
        metadata: { referrerUserId: String(user._id) },
      });
      user.referralCode = code;
      user.referralPromotionCodeId = promotionCode.id;
      await user.save();
      return { code, shareUrl: shareUrlFor(code) };
    } catch (err) {
      if (err?.code === "resource_already_exists") continue; // code taken at the Stripe level, try another
      throw err;
    }
  }
  throw Object.assign(new Error("Could not generate a referral code — please try again."), { userFacing: true, status: 500 });
}

function shareUrlFor(code) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl}/pricing?ref=${encodeURIComponent(code)}`;
}

// Called from the checkout.session.completed webhook — reads whichever
// Promotion Code was actually applied to the completed session and, if it
// matches a referrer on file, credits their redemption counter. Never
// throws: a lookup miss here (e.g. metadata not expanded, code not one of
// ours) should never fail the webhook.
export async function creditReferralIfApplicable(session) {
  try {
    const promoCodeId =
      typeof session.discounts?.[0]?.promotion_code === "string" ? session.discounts[0].promotion_code : session.discounts?.[0]?.promotion_code?.id;
    if (!promoCodeId) return;
    const referrer = await User.findOne({ referralPromotionCodeId: promoCodeId });
    if (!referrer) return;
    referrer.referralRedemptions = (referrer.referralRedemptions || 0) + 1;
    await referrer.save();
    console.log(`[billing] Referral code redeemed: referrer ${referrer._id} (promotion code ${promoCodeId}).`);
  } catch (err) {
    console.error(`[billing] Failed to credit referral redemption: ${err.message}`);
  }
}
