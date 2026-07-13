import { http } from "./api.js";

// Separate module from services/api.js — keeps the regular app's API
// surface from being bloated with admin-only endpoints, while reusing the
// same configured axios instance (auth header injection, silent-refresh
// interceptor) via the shared `http` export.
export const adminApi = {
  getOverview: () => http.get("/admin/overview").then((r) => r.data),
  getAiUsage: () => http.get("/admin/usage/ai").then((r) => r.data),
  getFileStorageStats: () => http.get("/admin/usage/files").then((r) => r.data),
  getGenerationStats: () => http.get("/admin/usage/generations").then((r) => r.data),
  getQueueStatus: () => http.get("/admin/system/queue").then((r) => r.data),
  getErrorLogs: (params) => http.get("/admin/system/errors", { params }).then((r) => r.data),
  getSystemHealth: () => http.get("/admin/system/health").then((r) => r.data),
  listSupportTickets: (params) => http.get("/admin/support", { params }).then((r) => r.data),
  getSupportTicket: (id) => http.get(`/admin/support/${id}`).then((r) => r.data),
  updateSupportTicket: (id, payload) => http.patch(`/admin/support/${id}`, payload).then((r) => r.data),
  addSupportTicketNote: (id, note) => http.post(`/admin/support/${id}/notes`, { note }).then((r) => r.data),
  listContactMessages: (params) => http.get("/admin/contact", { params }).then((r) => r.data),
  getContactMessage: (id) => http.get(`/admin/contact/${id}`).then((r) => r.data),
  updateContactMessage: (id, payload) => http.patch(`/admin/contact/${id}`, payload).then((r) => r.data),
  listCoupons: () => http.get("/admin/coupons").then((r) => r.data),
  createCoupon: (payload) => http.post("/admin/coupons", payload).then((r) => r.data),
  setCouponActive: (id, active) => http.patch(`/admin/coupons/${id}`, { active }).then((r) => r.data),
  // Reports need the in-memory Bearer token (there's no auth cookie usable
  // outside /api/auth), so a plain <a href> download won't authenticate —
  // fetch as a blob through the shared axios instance and trigger the
  // download client-side instead.
  downloadReport: async (report) => {
    const res = await http.get(`/admin/reports/${report}.csv`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  searchUsers: (params) => http.get("/admin/users", { params }).then((r) => r.data),
  getUser: (id) => http.get(`/admin/users/${id}`).then((r) => r.data),
  banUser: (id, reason) => http.post(`/admin/users/${id}/ban`, { reason }).then((r) => r.data),
  unbanUser: (id) => http.post(`/admin/users/${id}/unban`).then((r) => r.data),
  deleteUser: (id) => http.delete(`/admin/users/${id}`).then((r) => r.data),
  overrideSubscription: (id, payload) => http.patch(`/admin/users/${id}/subscription`, payload).then((r) => r.data),
};
