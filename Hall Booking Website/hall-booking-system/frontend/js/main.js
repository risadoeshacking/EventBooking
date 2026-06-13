// Theme toggle (light/dark) with persistence
/* ============================================================
   EventSpace — Global Utilities
   Theme toggle, mobile nav, and shared helpers
   ============================================================ */
(function () {
  "use strict";

  const root = document.documentElement;

  // Theme toggle
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    const saved = localStorage.getItem("eventspace_theme") || "light";
    root.dataset.theme = saved;
    themeToggle.addEventListener("click", () => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      root.dataset.theme = next;
      localStorage.setItem("eventspace_theme", next);
    });
  }

  // Mobile nav toggle
  const navToggle = document.getElementById("navToggle");
  const mobilePanel = document.getElementById("mobilePanel");
  if (navToggle && mobilePanel) {
    navToggle.addEventListener("click", () => {
      mobilePanel.classList.toggle("hidden");
    });
  }
})();
