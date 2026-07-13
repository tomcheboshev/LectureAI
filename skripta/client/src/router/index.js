import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const routes = [
  { path: "/", name: "landing", component: () => import("../pages/LandingPage.vue"), meta: { layout: "landing" } },
  { path: "/login", name: "login", component: () => import("../pages/LoginPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/register", name: "register", component: () => import("../pages/RegisterPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/forgot-password", name: "forgot-password", component: () => import("../pages/ForgotPasswordPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/reset-password/:token", name: "reset-password", component: () => import("../pages/ResetPasswordPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/verify-email/:token", name: "verify-email", component: () => import("../pages/VerifyEmailPage.vue"), meta: { layout: "landing" } },
  { path: "/dashboard", name: "dashboard", component: () => import("../pages/DashboardPage.vue"), meta: { requiresAuth: true } },
  { path: "/analytics", name: "analytics", component: () => import("../pages/AnalyticsPage.vue"), meta: { requiresAuth: true } },
  { path: "/new", name: "upload", component: () => import("../pages/UploadPage.vue"), meta: { requiresAuth: true } },
  { path: "/package/:id", name: "package", component: () => import("../pages/StudyPackagePage.vue"), props: true, meta: { requiresAuth: true } },
  { path: "/settings", name: "settings", component: () => import("../pages/SettingsPage.vue"), meta: { requiresAuth: true } },
  { path: "/settings/support", name: "settings-support", component: () => import("../pages/SupportTicketsPage.vue"), meta: { requiresAuth: true } },
  { path: "/contact", name: "contact", component: () => import("../pages/ContactPage.vue"), meta: { layout: "landing" } },
  { path: "/admin", name: "admin-overview", component: () => import("../pages/admin/AdminOverviewPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/users", name: "admin-users", component: () => import("../pages/admin/AdminUsersPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/users/:id", name: "admin-user-detail", component: () => import("../pages/admin/AdminUserDetailPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/revenue", name: "admin-revenue", component: () => import("../pages/admin/AdminRevenuePage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/ai-usage", name: "admin-ai-usage", component: () => import("../pages/admin/AdminAiUsagePage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/generation", name: "admin-generation", component: () => import("../pages/admin/AdminGenerationStatsPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/queue", name: "admin-queue", component: () => import("../pages/admin/AdminQueuePage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/errors", name: "admin-errors", component: () => import("../pages/admin/AdminErrorLogsPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/health", name: "admin-health", component: () => import("../pages/admin/AdminSystemHealthPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/support", name: "admin-support", component: () => import("../pages/admin/AdminSupportPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/contact", name: "admin-contact", component: () => import("../pages/admin/AdminContactPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/coupons", name: "admin-coupons", component: () => import("../pages/admin/AdminCouponsPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/admin/reports", name: "admin-reports", component: () => import("../pages/admin/AdminReportsPage.vue"), meta: { requiresAuth: true, requiresAdmin: true, layout: "admin" } },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("../pages/NotFoundPage.vue"), meta: { layout: "landing" } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) await auth.init();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && auth.user?.role !== "admin") {
    return { path: "/dashboard" };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { path: "/dashboard" };
  }
  return true;
});

export default router;
