import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

// Exported (not just used locally) so scripts/prerender.mjs and
// scripts/generate-sitemap.mjs can enumerate every meta.seo.prerender
// route straight from this one array — the single source of truth for
// "which public routes exist," instead of a second, driftable route list.
export const routes = [
  { path: "/", name: "landing", component: () => import("../pages/LandingPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "weekly", priority: 1.0 } } },
  { path: "/login", name: "login", component: () => import("../pages/LoginPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/register", name: "register", component: () => import("../pages/RegisterPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/forgot-password", name: "forgot-password", component: () => import("../pages/ForgotPasswordPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/reset-password/:token", name: "reset-password", component: () => import("../pages/ResetPasswordPage.vue"), meta: { layout: "landing", guestOnly: true } },
  { path: "/verify-email/:token", name: "verify-email", component: () => import("../pages/VerifyEmailPage.vue"), meta: { layout: "landing" } },
  { path: "/verify-email-change/:token", name: "verify-email-change", component: () => import("../pages/VerifyEmailChangePage.vue"), meta: { layout: "landing" } },
  { path: "/oauth/callback", name: "oauth-callback", component: () => import("../pages/OAuthCallbackPage.vue"), meta: { layout: "landing" } },
  { path: "/dashboard", name: "dashboard", component: () => import("../pages/DashboardPage.vue"), meta: { requiresAuth: true } },
  { path: "/analytics", name: "analytics", component: () => import("../pages/AnalyticsPage.vue"), meta: { requiresAuth: true } },
  { path: "/new", name: "upload", component: () => import("../pages/UploadPage.vue"), meta: { requiresAuth: true } },
  { path: "/package/:id", name: "package", component: () => import("../pages/StudyPackagePage.vue"), props: true, meta: { requiresAuth: true } },
  { path: "/settings", name: "settings", component: () => import("../pages/SettingsPage.vue"), meta: { requiresAuth: true } },
  { path: "/settings/support", name: "settings-support", component: () => import("../pages/SupportTicketsPage.vue"), meta: { requiresAuth: true } },
  { path: "/settings/sessions", name: "settings-sessions", component: () => import("../pages/SessionsPage.vue"), meta: { requiresAuth: true } },
  { path: "/payment/success", name: "payment-success", component: () => import("../pages/PaymentSuccessPage.vue"), meta: { requiresAuth: true } },
  { path: "/payment/cancelled", name: "payment-cancelled", component: () => import("../pages/PaymentCancelledPage.vue"), meta: { requiresAuth: true } },
  { path: "/payment/failed", name: "payment-failed", component: () => import("../pages/PaymentFailedPage.vue"), meta: { requiresAuth: true } },
  { path: "/payment/pending", name: "payment-pending", component: () => import("../pages/PaymentPendingPage.vue"), meta: { requiresAuth: true } },
  { path: "/subscription/cancelled", name: "subscription-cancelled", component: () => import("../pages/SubscriptionCancelledPage.vue"), meta: { requiresAuth: true } },
  { path: "/contact", name: "contact", component: () => import("../pages/ContactPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "yearly", priority: 0.5 } } },
  { path: "/features", name: "features", component: () => import("../pages/FeaturesPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "monthly", priority: 0.9 } } },
  { path: "/pricing", name: "pricing", component: () => import("../pages/PricingPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "weekly", priority: 0.9 } } },
  { path: "/blog", name: "blog", component: () => import("../pages/BlogIndexPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "weekly", priority: 0.7 } } },
  { path: "/blog/:slug", name: "blog-post", component: () => import("../pages/BlogPostPage.vue"), meta: { layout: "landing" } },
  { path: "/faq", name: "faq", component: () => import("../pages/FaqPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "monthly", priority: 0.7 } } },
  { path: "/about", name: "about", component: () => import("../pages/AboutPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "yearly", priority: 0.6 } } },
  { path: "/privacy", name: "privacy", component: () => import("../pages/PrivacyPolicyPage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "yearly", priority: 0.3 } } },
  { path: "/terms", name: "terms", component: () => import("../pages/TermsOfServicePage.vue"), meta: { layout: "landing", seo: { prerender: true, changefreq: "yearly", priority: 0.3 } } },
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

// A factory (not a module-level singleton) — the prerender script builds a
// fresh app/router/pinia trio per route it renders in a single Node
// process, and a shared singleton would leak navigation state across those
// renders. The browser still only ever calls this once, from main.js.
export function createAppRouter() {
  const router = createRouter({
    // createWebHistory() reads `window` at construction time, which doesn't
    // exist under Node during prerendering — createMemoryHistory() there
    // instead (each render() call gets its own isolated in-memory stack).
    history: import.meta.env.SSR ? createMemoryHistory() : createWebHistory(),
    routes,
    scrollBehavior() {
      return { top: 0 };
    },
  });

  router.beforeEach(async (to) => {
    // Prerendering only ever renders public (non-requiresAuth) routes, and
    // must never depend on a live API call at build time — skip the auth
    // check entirely during SSR/prerendering.
    if (import.meta.env.SSR) return true;

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

  return router;
}
