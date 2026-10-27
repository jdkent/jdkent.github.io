import { createLazySusan } from "./lazy-susan.js";
import { field, reducedMotion } from "./site.js";

// Panels: links without JavaScript, a turntable of tabs with it. The panel at
// the front is the selected tab, and its list shows in the stage below.
const nav = document.querySelector(".lobes");
const tablist = nav.querySelector(".lobes__grid");
const tabs = [...tablist.querySelectorAll(".lobe")];
const panelFor = (tab) => document.getElementById(tab.getAttribute("aria-controls"));
const stage = document.querySelector(".stage");
let ready = false;
let hashTimer = 0;

tablist.setAttribute("role", "tablist");
tablist.setAttribute("aria-label", "Profile sections");
tabs.forEach((tab) => {
  tab.setAttribute("role", "tab");
  const panel = panelFor(tab);
  panel.setAttribute("role", "tabpanel");
  panel.tabIndex = -1;
});

function select(tab) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    panelFor(t).hidden = !on;
  }
  stage.classList.add("is-open");
  if (!ready) return;
  // Record the section once the ring settles: spinning passes many panels a
  // second, and Safari throws after 100 replaceState calls in 30 seconds.
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, "", `#${tab.dataset.key}`), 400);
}

function fireFrom(tab) {
  const box = tab.getBoundingClientRect();
  field.stimulate(box.left + box.width / 2, box.top + box.height / 2);
}

nav.classList.add("is-ring");
nav.querySelector(".lobes__controls").hidden = false;
const susan = createLazySusan(nav, tablist, tabs, {
  reducedMotion,
  onFront(i) {
    // Every panel that passes the front fires the network, so spinning
    // quickly through the menu builds up activity. Measure before select()
    // changes the layout, so reading the box does not force a reflow.
    if (ready) fireFrom(tabs[i]);
    select(tabs[i]);
  },
});
window.addEventListener("resize", () => susan.layout());

for (const button of nav.querySelectorAll(".lobes__step")) {
  button.addEventListener("click", () => susan.spin(Number(button.dataset.step)));
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", (event) => {
    // Let modified clicks open the full category page in a new tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    // A pointer press has already fired the network; keyboard activation
    // (detail 0) has no pointer, so fire from the panel itself.
    if (i !== susan.front) susan.goTo(i);
    else if (event.detail === 0) fireFrom(tab);
  });

  tab.addEventListener("keydown", (event) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    if (event.key === " ") {
      event.preventDefault();
      tab.click();
    } else if (event.key in moves || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (i + moves[event.key] + tabs.length) % tabs.length;
      susan.goTo(next);
      tabs[next].focus({ preventScroll: true });
    }
  });
});

const initial = tabs.find((t) => `#${t.dataset.key}` === location.hash) || tabs[0];
select(initial);
susan.goTo(tabs.indexOf(initial), { instant: true });
ready = true;
