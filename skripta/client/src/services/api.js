import axios from "axios";
import { useI18n } from "../composables/useI18n.js";

export const http = axios.create({ baseURL: "/api", withCredentials: true });

// The access token lives in memory only (set by the auth store on
// login/refresh) — never localStorage, to keep it out of reach of any
// XSS payload. The refresh token is a separate httpOnly cookie the browser
// sends automatically; JS never touches it.
let accessToken = null;
export function setAccessToken(token) {
  accessToken = token;
}

// Reads the non-httpOnly csrf_token cookie (set by the server alongside the
// refresh cookie — see server/src/middleware/csrf.js) and echoes it back as
// a header. Attached unconditionally on every request rather than only on
// /refresh and /logout — the two routes that actually check it — since an
// extra unused header is harmless and this keeps the interceptor simple.
function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

http.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const csrfToken = readCsrfCookie();
  if (csrfToken) config.headers["X-CSRF-Token"] = csrfToken;
  return config;
});

// On a 401 (expired access token), try exactly one silent refresh via the
// httpOnly cookie, then retry the original request. If refresh also fails,
// give up and let the caller (ultimately the router guard) send the user
// to /login. `onUnauthorized` is wired up by the auth store to avoid a
// circular import between the store and this module.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Endpoints that must never trigger an auto-refresh-and-retry: they're
// either the refresh call itself (would recurse) or pre-login flows that
// legitimately 401/expect no session. Every other endpoint — including
// other /auth/* routes like /auth/me — is a normal Bearer-protected route
// and should get the silent-refresh treatment like any other.
const NO_REFRESH_RETRY = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);

let refreshPromise = null;
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const message = err.response?.data?.error || err.message || useI18n().t("errors.requestFailed");

    if (status === 401 && !original?._retried && !NO_REFRESH_RETRY.has(original?.url)) {
      original._retried = true;
      try {
        refreshPromise ||= http.post("/auth/refresh").finally(() => {
          refreshPromise = null;
        });
        const { data } = await refreshPromise;
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return http(original);
      } catch {
        onUnauthorized();
      }
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.upgradeRequired = err.response?.data?.upgradeRequired;
    wrapped.reason = err.response?.data?.reason;
    wrapped.limit = err.response?.data?.limit;
    wrapped.plan = err.response?.data?.plan;
    wrapped.retryAfterSeconds = err.response?.data?.retryAfterSeconds;
    return Promise.reject(wrapped);
  }
);

export const api = {
  // Auth
  register: (payload) => http.post("/auth/register", payload).then((r) => r.data),
  login: (payload) => http.post("/auth/login", payload).then((r) => r.data),
  logout: () => http.post("/auth/logout").then((r) => r.data),
  refresh: () => http.post("/auth/refresh").then((r) => r.data),
  forgotPassword: (payload) => http.post("/auth/forgot-password", payload).then((r) => r.data),
  resetPassword: (payload) => http.post("/auth/reset-password", payload).then((r) => r.data),
  verifyEmail: (payload) => http.post("/auth/verify-email", payload).then((r) => r.data),
  resendVerification: () => http.post("/auth/resend-verification").then((r) => r.data),
  changePassword: (payload) => http.post("/auth/change-password", payload).then((r) => r.data),
  getMe: () => http.get("/auth/me").then((r) => r.data),
  updateProfile: (payload) => http.patch("/auth/me", payload).then((r) => r.data),
  deleteAccount: (payload) => http.delete("/auth/me", { data: payload }).then((r) => r.data),
  reactivate: () => http.post("/auth/reactivate").then((r) => r.data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("avatar", file);
    return http.post("/auth/avatar", form).then((r) => r.data);
  },
  changeEmail: (payload) => http.post("/auth/email", payload).then((r) => r.data),
  verifyEmailChange: (payload) => http.post("/auth/verify-email-change", payload).then((r) => r.data),
  getConnectedAccounts: () => http.get("/auth/connected-accounts").then((r) => r.data),
  disconnectProvider: (provider) => http.delete(`/auth/connected-accounts/${provider}`).then((r) => r.data),
  // Triggers a same-tab download (Content-Disposition: attachment) — the
  // browser handles saving it, no blob/URL.createObjectURL dance needed
  // like the admin CSV reports (those need the Bearer header attached
  // manually since a plain <a href> can't carry it; this one does too, for
  // the same reason, hence responseType: "blob").
  exportData: async () => {
    const res = await http.get("/auth/export-data", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lectureai-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  // OAuth is a real browser navigation (an <a href>), not a fetch — this
  // capability check just tells the UI which "Continue with" buttons to
  // show, matching whichever providers actually have credentials configured
  // server-side.
  getOAuthProviders: () => http.get("/auth/oauth/providers").then((r) => r.data),

  // Session management (Settings > Sessions)
  listSessions: () => http.get("/auth/sessions").then((r) => r.data),
  revokeSession: (sessionId) => http.delete(`/auth/sessions/${sessionId}`).then((r) => r.data),
  revokeOtherSessions: () => http.post("/auth/sessions/revoke-others").then((r) => r.data),
  revokeAllSessions: () => http.post("/auth/sessions/revoke-all").then((r) => r.data),

  // Billing (Stripe Checkout for new subscriptions, Stripe's own hosted
  // Billing Portal for upgrade/downgrade/cancel/resume/invoices).
  createCheckoutSession: (plan) => http.post("/billing/checkout", { plan }).then((r) => r.data),
  createBillingPortalSession: () => http.post("/billing/portal").then((r) => r.data),
  getSubscription: () => http.get("/billing/subscription").then((r) => r.data),
  getInvoices: () => http.get("/billing/invoices").then((r) => r.data),
  getCheckoutSession: (sessionId) => http.get(`/billing/checkout-session/${sessionId}`).then((r) => r.data),
  cancelSubscription: (mode, reason) => http.post("/billing/cancel", { mode, reason }).then((r) => r.data),
  resumeSubscription: () => http.post("/billing/resume").then((r) => r.data),
  retryInvoice: (invoiceId) => http.post("/billing/retry-invoice", { invoiceId }).then((r) => r.data),
  getReferral: () => http.get("/referrals/mine").then((r) => r.data),

  // Study packages
  listPackages: () => http.get("/packages").then((r) => r.data),
  getPackage: (id) => http.get(`/packages/${id}`).then((r) => r.data),
  renamePackage: (id, video_title) => http.patch(`/packages/${id}`, { video_title }).then((r) => r.data),
  duplicatePackage: (id) => http.post(`/packages/${id}/duplicate`).then((r) => r.data),
  retryPackage: (id) => http.post(`/packages/${id}/retry`).then((r) => r.data),
  deletePackage: (id) => http.delete(`/packages/${id}`).then((r) => r.data),
  generate: (payload) => http.post("/packages/generate", payload).then((r) => r.data),
  generateFromYoutube: (payload) => http.post("/packages/from-youtube", payload).then((r) => r.data),
  generateFromFiles: (formData, onUploadProgress) =>
    http
      .post("/packages/from-files", formData, { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress })
      .then((r) => r.data),
  regenerateSection: (id, section) => http.post(`/packages/${id}/regenerate`, { section }).then((r) => r.data),
  explainConcept: (id, payload) => http.post(`/packages/${id}/explain`, payload).then((r) => r.data),
  chat: (id, messages) => http.post(`/chat/${id}`, { messages }).then((r) => r.data),
  getChatHistory: (id) => http.get(`/chat/${id}`).then((r) => r.data),
  clearChatHistory: (id) => http.delete(`/chat/${id}`).then((r) => r.data),

  // Analytics
  submitQuizAttempt: (id, answers) => http.post(`/packages/${id}/quiz-attempts`, { answers }).then((r) => r.data),
  submitFlashcardReview: (id, cardIndex, known) => http.post(`/packages/${id}/flashcard-reviews`, { cardIndex, known }).then((r) => r.data),
  getAnalytics: () => http.get("/analytics").then((r) => r.data),

  // Support (own tickets — status-only, no reply thread) + public contact form
  createSupportTicket: (payload) => http.post("/support", payload).then((r) => r.data),
  listSupportTickets: () => http.get("/support").then((r) => r.data),
  getSupportTicket: (id) => http.get(`/support/${id}`).then((r) => r.data),
  submitContactMessage: (payload) => http.post("/contact", payload).then((r) => r.data),
};
