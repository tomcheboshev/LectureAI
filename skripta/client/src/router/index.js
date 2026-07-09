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
  { path: "/new", name: "upload", component: () => import("../pages/UploadPage.vue"), meta: { requiresAuth: true } },
  { path: "/package/:id", name: "package", component: () => import("../pages/StudyPackagePage.vue"), props: true, meta: { requiresAuth: true } },
  { path: "/settings", name: "settings", component: () => import("../pages/SettingsPage.vue"), meta: { requiresAuth: true } },
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
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { path: "/dashboard" };
  }
  return true;
});

export default router;
