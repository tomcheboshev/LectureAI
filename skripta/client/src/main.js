import { createHead } from "@unhead/vue/client";
import { createSsrApp } from "./app.js";
import { useThemeStore } from "./stores/theme.js";
import { useLocaleStore } from "./stores/locale.js";
import "./style.css";

const { app } = createSsrApp();
app.use(createHead());

// Client-only: reads localStorage/matchMedia, so these must never run
// during prerendering — the SSR defaults (light theme, English) are
// exactly what should be baked into the static HTML instead.
useThemeStore().init();
useLocaleStore().init();

// Mounts fresh over any prerendered markup rather than hydrating it — see
// app.js's comment for why.
app.mount("#app");
