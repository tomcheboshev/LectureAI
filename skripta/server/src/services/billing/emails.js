import { sendMail } from "../auth/email.js";

function clientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

function formatMoney(amount, currency) {
  if (typeof amount !== "number") return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount / 100);
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

export async function sendWelcomePremiumEmail(user) {
  const url = `${clientUrl()}/settings`;
  await sendMail({
    to: user.email,
    subject: "Welcome to LectureAI Premium!",
    text: `Hi ${user.name},\n\nYour subscription is now active — thanks for upgrading to Premium!\n\nManage your subscription any time: ${url}\n\nHappy studying,\nThe LectureAI team`,
  });
}

// Covers renewals only (the first invoice is covered by Welcome Premium
// above) — per the locked decision, this collapses what would otherwise be
// three separate emails (Payment Success / Subscription Renewed / Invoice
// Available) into one.
export async function sendPaymentSuccessEmail(user, invoice) {
  const amount = formatMoney(invoice.amount_paid, invoice.currency);
  const pdfLine = invoice.invoicePdfUrl || invoice.invoice_pdf ? `\nDownload your invoice: ${invoice.invoicePdfUrl || invoice.invoice_pdf}` : "";
  await sendMail({
    to: user.email,
    subject: "Payment received — LectureAI",
    text: `Hi ${user.name},\n\nWe've successfully charged ${amount} for your LectureAI subscription renewal.${pdfLine}\n\nManage your subscription: ${clientUrl()}/settings`,
  });
}

export async function sendPaymentFailedEmail(user) {
  const url = `${clientUrl()}/payment/failed`;
  await sendMail({
    to: user.email,
    subject: "Action needed: your LectureAI payment failed",
    text: `Hi ${user.name},\n\nWe weren't able to charge your payment method for your LectureAI subscription. Your Premium access continues for now, but please update your payment method or retry the charge soon to avoid losing access.\n\nFix it here: ${url}`,
  });
}

export async function sendTrialEndingEmail(user) {
  const url = `${clientUrl()}/settings`;
  const endsAt = formatDate(user.trialEndsAt);
  await sendMail({
    to: user.email,
    subject: "Your LectureAI trial is ending soon",
    text: `Hi ${user.name},\n\nYour free trial ends${endsAt ? ` on ${endsAt}` : " soon"}. After that, your saved payment method will be charged automatically to continue your Premium subscription.\n\nManage your subscription: ${url}`,
  });
}

export async function sendSubscriptionCancelledEmail(user) {
  const keepsAccess = Boolean(user.cancelAtPeriodEnd) && user.subscriptionStatus !== "canceled";
  const accessUntil = formatDate(user.currentPeriodEnd);
  const body = keepsAccess
    ? `Your subscription has been cancelled. You'll keep Premium access until ${accessUntil || "the end of your current billing period"}, after which you'll move to the Free plan.`
    : `Your subscription has been cancelled and your account has moved to the Free plan.`;
  await sendMail({
    to: user.email,
    subject: "Your LectureAI subscription was cancelled",
    text: `Hi ${user.name},\n\n${body}\n\nChanged your mind? You can resume any time: ${clientUrl()}/settings`,
  });
}

export async function sendSubscriptionResumedEmail(user) {
  await sendMail({
    to: user.email,
    subject: "Your LectureAI subscription was reactivated",
    text: `Hi ${user.name},\n\nGood news — your subscription has been reactivated and will continue to renew as normal.\n\nManage your subscription: ${clientUrl()}/settings`,
  });
}

export async function sendRefundProcessedEmail(user, charge) {
  const amount = formatMoney(charge.amount_refunded, charge.currency);
  await sendMail({
    to: user.email,
    subject: "Your LectureAI refund has been processed",
    text: `Hi ${user.name},\n\nA refund of ${amount} has been issued to your original payment method. It may take a few business days to appear on your statement.\n\nQuestions? Reply to this email or visit ${clientUrl()}/settings/support`,
  });
}
