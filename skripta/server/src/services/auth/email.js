// No email provider is configured yet. In this "dev mode" we log the link
// to the server console and also return it in the API response so the flow
// is fully testable end-to-end. To go live, replace the body of sendMail()
// with a real provider call (Resend/SendGrid/SMTP) — every call site already
// has the right token/url, nothing else needs to change.
function sendMail({ to, subject, text }) {
  console.log(`\n[dev-email] To: ${to}\nSubject: ${subject}\n${text}\n`);
  return Promise.resolve();
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
