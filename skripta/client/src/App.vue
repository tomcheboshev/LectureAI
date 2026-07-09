<template>
  <component :is="layout">
    <RouterView v-if="isLanding" v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </component>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, RouterView } from "vue-router";
import AppShell from "./layouts/AppShell.vue";

const route = useRoute();
const isLanding = computed(() => route.meta.layout === "landing");
const layout = computed(() => (isLanding.value ? "div" : AppShell));
</script>
