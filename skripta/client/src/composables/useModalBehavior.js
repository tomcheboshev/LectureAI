import { watch, onUnmounted } from "vue";

// Shared modal ergonomics: Escape-to-close and body-scroll-lock while open —
// previously every modal in the app (Modal.vue, UpgradeModal.vue,
// SettingsPage.vue's delete dialog) had neither, so the page behind a modal
// kept scrolling and Escape did nothing.
export function useModalBehavior(isOpenRef, onClose) {
  let previousOverflow = "";

  function handleKeydown(e) {
    if (e.key === "Escape") onClose();
  }

  watch(
    isOpenRef,
    (isOpen) => {
      if (isOpen) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeydown);
      } else {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", handleKeydown);
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    document.body.style.overflow = previousOverflow;
    document.removeEventListener("keydown", handleKeydown);
  });
}
