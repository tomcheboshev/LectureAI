<template>
  <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-border-dark bg-black aspect-video">
    <div :id="mountId" class="w-full h-full"></div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from "vue";

const props = defineProps({ videoId: { type: String, required: true } });
const mountId = `yt-player-${props.videoId}-${Math.random().toString(36).slice(2, 8)}`;

let player = null;

function loadIframeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window.__ytApiPromise) return window.__ytApiPromise;

  window.__ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return window.__ytApiPromise;
}

onMounted(async () => {
  const YT = await loadIframeApi();
  player = new YT.Player(mountId, {
    videoId: props.videoId,
    playerVars: { rel: 0 },
  });
});

onBeforeUnmount(() => {
  player?.destroy?.();
});

function seekTo(seconds) {
  player?.seekTo?.(seconds, true);
  player?.playVideo?.();
}

defineExpose({ seekTo });
</script>
