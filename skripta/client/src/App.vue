<template>
  <component :is="layout">
    <!-- No <Transition> here (deliberately, not an oversight). Confirmed via
         direct DOM/router introspection: wrapping this in
         <Transition name="page" mode="out-in"> reproduced a serious bug —
         router.currentRoute updates correctly on navigation (URL, matched
         route, everything reactive-Vue-Router-side is correct) but the
         previous page's DOM never gets replaced, with no console error.
         Dropping mode="out-in" (Vue's default simultaneous transition)
         avoided that total-stall symptom, but left both the leaving AND
         entering page fully mounted and visible at once instead (the
         leave-phase CSS classes were never applied, so the old page never
         faded out or unmounted). This keyed, plain swap is what's verified
         (repeatedly, from a clean dev server) to reliably show exactly the
         one correct page. The exact mechanism wasn't fully root-caused —
         if re-adding a transition here, verify with the same test (click
         between two landing-layout routes, check `document.title` and the
         actual rendered heading, not just the URL) before trusting it. -->
    <RouterView v-if="isLanding" v-slot="{ Component }">
      <component :is="Component" :key="route.fullPath" />
    </RouterView>
  </component>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, RouterView } from "vue-router";
import AppShell from "./layouts/AppShell.vue";
import AdminShell from "./layouts/AdminShell.vue";

const route = useRoute();
const isLanding = computed(() => route.meta.layout === "landing");
const layout = computed(() => {
  if (isLanding.value) return "div";
  if (route.meta.layout === "admin") return AdminShell;
  return AppShell;
});
</script>
