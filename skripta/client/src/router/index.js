import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", name: "landing", component: () => import("../pages/LandingPage.vue"), meta: { layout: "landing" } },
  { path: "/dashboard", name: "dashboard", component: () => import("../pages/DashboardPage.vue") },
  { path: "/new", name: "upload", component: () => import("../pages/UploadPage.vue") },
  { path: "/package/:id", name: "package", component: () => import("../pages/StudyPackagePage.vue"), props: true },
  { path: "/settings", name: "settings", component: () => import("../pages/SettingsPage.vue") },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("../pages/NotFoundPage.vue"), meta: { layout: "landing" } },
];

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});
