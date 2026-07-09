import axios from "axios";

const http = axios.create({ baseURL: "/api", withCredentials: true });

// The access token lives in memory only (set by the auth store on
// login/refresh) — never localStorage, to keep it out of reach of any
// XSS payload. The refresh token is a separate httpOnly cookie the browser
// sends automatically; JS never touches it.
let accessToken = null;
export function setAccessToken(token) {
  accessToken = token;
}

http.interceptors.request.use((config) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
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
    const message = err.response?.data?.error || err.message || "Request failed";

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
  upgradePlan: (plan) => http.post("/auth/upgrade", { plan }).then((r) => r.data),

  // Study packages
  listPackages: () => http.get("/packages").then((r) => r.data),
  getPackage: (id) => http.get(`/packages/${id}`).then((r) => r.data),
  renamePackage: (id, video_title) => http.patch(`/packages/${id}`, { video_title }).then((r) => r.data),
  duplicatePackage: (id) => http.post(`/packages/${id}/duplicate`).then((r) => r.data),
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
};
