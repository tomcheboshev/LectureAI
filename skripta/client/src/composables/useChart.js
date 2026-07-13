import { onMounted, onBeforeUnmount, watch } from "vue";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

// One shared lifecycle wrapper for every chart in the admin panel — creates
// the Chart.js instance on mount against a canvas ref, updates it reactively
// when data/options change, and destroys it on unmount. Avoids duplicating
// this boilerplate per chart type (Chart.js's own `type` option already
// covers line/bar/doughnut variation, so one wrapper is enough).
export function useChart(canvasRef, configRef) {
  let chart = null;

  function build() {
    if (!canvasRef.value || !configRef.value) return;
    chart = new Chart(canvasRef.value, configRef.value);
  }

  function destroy() {
    chart?.destroy();
    chart = null;
  }

  onMounted(build);
  onBeforeUnmount(destroy);

  watch(
    configRef,
    (config) => {
      if (!config) return;
      if (!chart) {
        build();
        return;
      }
      chart.data = config.data;
      chart.options = config.options || chart.options;
      chart.config.type = config.type;
      chart.update();
    },
    { deep: true }
  );
}
