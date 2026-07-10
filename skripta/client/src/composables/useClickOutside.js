import { onMounted, onUnmounted } from "vue";

// Closes a ref-backed boolean flag (e.g. a dropdown's `open` state) when the
// user clicks anywhere outside the given element ref. Also closes on Escape,
// since dropdown menus are expected to respond to it like other dismissible
// UI in this app.
export function useClickOutside(elementRef, onOutside) {
  function handlePointerDown(e) {
    const el = elementRef.value;
    if (el && !el.contains(e.target)) onOutside(e);
  }
  function handleKeydown(e) {
    if (e.key === "Escape") onOutside(e);
  }

  onMounted(() => {
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeydown);
  });
  onUnmounted(() => {
    document.removeEventListener("mousedown", handlePointerDown);
    document.removeEventListener("keydown", handleKeydown);
  });
}
