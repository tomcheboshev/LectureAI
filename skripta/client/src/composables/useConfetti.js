const COLORS = ["#4F46E5", "#7C3AED", "#06B6D4", "#22C55E", "#F59E0B"];

/** Lightweight DOM/CSS confetti burst — no external dependency. */
export function fireConfetti(count = 90) {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    const left = Math.random() * 100;
    const duration = 2.2 + Math.random() * 1.6;
    const delay = Math.random() * 0.3;
    const rotate = Math.random() * 360;
    const drift = (Math.random() - 0.5) * 200;

    piece.style.cssText = `
      position:absolute; top:-5%; left:${left}%;
      width:${size}px; height:${size * 0.4}px;
      background:${COLORS[i % COLORS.length]};
      opacity:0.9; border-radius:2px;
      transform: rotate(${rotate}deg);
      animation: confetti-fall ${duration}s ease-in ${delay}s forwards;
      --drift: ${drift}px;
    `;
    container.appendChild(piece);
  }

  if (!document.getElementById("confetti-keyframes")) {
    const style = document.createElement("style");
    style.id = "confetti-keyframes";
    style.textContent = `
      @keyframes confetti-fall {
        to { transform: translate(var(--drift), 105vh) rotate(600deg); opacity: 0.2; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => container.remove(), 4200);
}
