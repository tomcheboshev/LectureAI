import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import NewPackageView from "./views/NewPackageView.vue";
import PackageView from "./views/PackageView.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/new", name: "new", component: NewPackageView },
    { path: "/package/:id", name: "package", component: PackageView, props: true },
  ],
});
