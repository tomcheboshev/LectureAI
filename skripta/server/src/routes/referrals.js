import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { respondError } from "../utils/httpError.js";
import { ensureReferralCode } from "../services/billing/referrals.js";

const router = Router();
router.use(requireAuth);

// GET /api/referrals/mine — returns (minting on first call) the signed-in
// user's personal referral code and a ready-to-share pricing-page link.
router.get("/mine", async (req, res) => {
  try {
    const { code, shareUrl } = await ensureReferralCode(req.user);
    res.json({ code, shareUrl, redemptions: req.user.referralRedemptions || 0 });
  } catch (err) {
    console.error("Referral code lookup failed:", err);
    respondError(res, err, "Could not load your referral code. Please try again.");
  }
});

export default router;
