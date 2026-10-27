// Shared by every page: the theme switch, the neuron network behind the page,
// and the presses that fire it. Page scripts import `field` to fire it too.

import { createNeuralField } from "./neural-field.js";

const root = document.documentElement;
export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const field = createNeuralField(document.querySelector(".field"), {
  reducedMotion,
  // On slow rendering, drop blurred glass too: it is re-blurred every frame.
  onSlow: () => root.setAttribute("data-low-power", ""),
});

// Theme: the same "theme" localStorage key the rest of the site uses.
const themeSwitch = document.querySelector(".theme-switch");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeSwitch.textContent = theme === "dark" ? "Use light theme" : "Use dark theme";
  field.setTheme(theme === "dark");
}

themeSwitch.hidden = false;
themeSwitch.addEventListener("click", () => {
  const theme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", theme); } catch (e) {}
  applyTheme(theme);
});
applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
field.build();

// Rebuild only on real size changes; mobile browsers resize the viewport
// height as the address bar slides, which should not reshuffle the network.
let size = [window.innerWidth, window.innerHeight];
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const [w, h] = size;
    if (window.innerWidth !== w || Math.abs(window.innerHeight - h) > h * 0.25) {
      size = [window.innerWidth, window.innerHeight];
      field.build();
    }
  }, 150);
});

// Any press anywhere on the page fires the network where it lands.
document.addEventListener("pointerdown", (event) => {
  if (event.isPrimary && event.button === 0) field.stimulate(event.clientX, event.clientY);
});

// One quiet wave from the element marked data-wave-origin (the name) on load,
// to show the network is there.
const origin = document.querySelector("[data-wave-origin]");
if (origin) {
  const box = origin.getBoundingClientRect();
  setTimeout(() => field.stimulate(box.left + 24, box.top + box.height / 2, { arouse: false }), 500);
}
