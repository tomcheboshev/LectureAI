import { Router } from "express";
import { getStripe } from "../services/billing/stripe.js";
import { WEBHOOK_HANDLERS } from "../services/billing/webhookHandlers.js";
import { logError } from "../utils/logger.js";

const router = Router();

// POST /api/billing/webhook — Stripe calls this directly; there's no user
// session, so this deliberately does NOT go through requireAuth. Mounted in
// index.js with express.raw() BEFORE the global express.json() middleware,
// since signature verification needs the exact raw request bytes, not a
// parsed-then-re-serialized copy (which byte-for-byte differs from what
// Stripe signed and would fail verification every time).
router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[billing] Received a webhook but STRIPE_WEBHOOK_SECRET is not set — rejecting.");
    return res.status(500).send("Webhook secret not configured.");
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[billing] Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  const handler = WEBHOOK_HANDLERS[event.type];
  if (!handler) {
    // Ack with 200 so Stripe doesn't retry an event type this app simply
    // doesn't act on — Stripe sends far more event types than any one app
    // needs to handle.
    return res.status(200).json({ received: true, handled: false });
  }

  try {
    await handler(event);
    res.status(200).json({ received: true, handled: true });
  } catch (err) {
    // A 5xx tells Stripe to retry with backoff — right for a transient
    // failure (a Mongo blip); a persistent handler bug will also retry
    // repeatedly, but event.type/event.id here is enough to spot that.
    logError(err, { webhookEventType: event.type, webhookEventId: event.id });
    res.status(500).json({ error: "Webhook handler failed." });
  }
});

export default router;
