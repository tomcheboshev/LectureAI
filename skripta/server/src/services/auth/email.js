// Sends through Resend when RESEND_API_KEY is set; otherwise falls back to
// logging the email to the console so every flow stays fully testable
// end-to-end without real credentials. Every call site just calls sendMail()
// — nothing else needs to change when credentials are added or removed.
export async function sendMail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`\n[dev-email] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const from = process.env.RESEND_FROM_ADDRESS || "LectureAI <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html: html || undefined }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend send failed (${res.status}) to ${to}: ${body}`);
    }
  } catch (err) {
    // Never let a transient network/provider failure bubble up to the
    // caller — most callers (e.g. Stripe webhook handlers) have already
    // committed their DB state by this point, and throwing here would just
    // cause Stripe to retry a webhook whose only remaining side effect is
    // resending this same email.
    console.error(`[email] Failed to send to ${to}: ${err.message}`);
  }
}

function clientUrl() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}

export async function sendVerificationEmail(user, token) {
  const url = `${clientUrl()}/verify-email/${token}`;
  await sendMail({
    to: user.email,
    subject: "Verify your LectureAI email",
    text: `Hi ${user.name},\n\nVerify your email: ${url}\n\nThis link expires in 24 hours.`,
  });
  return url;
}

export async function sendPasswordResetEmail(user, token) {
  const url = `${clientUrl()}/reset-password/${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your LectureAI password",
    text: `Hi ${user.name},\n\nReset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
  return url;
}

// Sent to the NEW address during an email change (routes/auth.js POST
// /email) — deliberately not to the old one, since proving control of the
// new address is the entire point of this flow. `newEmail` is passed
// explicitly rather than read from `user.email`, since the user document's
// email field isn't updated until this link is clicked.
export async function sendEmailChangeVerification(user, newEmail, token) {
  const url = `${clientUrl()}/verify-email-change/${token}`;
  await sendMail({
    to: newEmail,
    subject: "Confirm your new LectureAI email address",
    text: `Hi ${user.name},\n\nConfirm your new email address: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email — your account email won't change.`,
  });
  return url;
}
