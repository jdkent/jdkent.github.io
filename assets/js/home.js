import { createLazySusan } from "./lazy-susan.js";
import { field, reducedMotion } from "./site.js";

// Home: a turntable of panels, each showing its newest item. A panel zooms
// in place into the whole section: the name moves up into a breadcrumb and
// the panel grows into a sheet, which shows the section's list, the bio, or
// a page. Pages open in the sheet too, so you never leave home. The hash
// records where you are, and show() draws the page from it:
//   #key         the panel at the front of the turntable
//   #key/        the panel zoomed in
//   #key/path    the page at `path`, open in the zoomed panel

const root = document.documentElement;
const page = document.querySelector(".page");
const colophon = document.querySelector(".colophon");
const scene = document.querySelector(".lobes");
const ring = scene.querySelector(".lobes__grid");
const lobes = [...ring.querySelectorAll(".lobe")];
const byKey = Object.fromEntries(lobes.map((l) => [l.dataset.key, l]));

const zoom = document.querySelector(".zoom");
const crumbs = zoom.querySelector(".crumbs");
const homeCrumb = crumbs.querySelector(".crumbs__home");
const sectionCrumb = crumbs.querySelector(".crumbs__section a");
const itemCrumb = crumbs.querySelector(".crumbs__item");
const sheet = zoom.querySelector(".sheet");
const about = sheet.querySelector(".sheet__about");
const lists = Object.fromEntries([...sheet.querySelectorAll("template[data-list]")].map((t) => [t.dataset.list, t]));
const listHost = Object.assign(document.createElement("div"), { className: "sheet__list" });
const frame = Object.assign(document.createElement("iframe"), { className: "sheet__frame" });
sheet.append(listHost);

const pathOf = (href) => new URL(href, location.href).pathname;

// Every listed item's path, with its panel and title, so a page opened from
// anywhere (a list, or a link inside another page) gets the right breadcrumb;
// and each section's own page, which zooms into that panel.
const items = new Map();
for (const [key, t] of Object.entries(lists)) {
  for (const a of t.content.querySelectorAll(".entry__title")) {
    items.set(pathOf(a.getAttribute("href")), { key, title: a.textContent.trim() });
  }
}
const sections = new Map(lobes.filter((l) => l.dataset.zoom !== "about").map((l) => [pathOf(l.dataset.url), l.dataset.key]));

// The hash for a page of this site, opened from the panel `from`.
function hashFor(path, from) {
  if (path === pathOf("/")) return `#${from}`;
  if (sections.has(path)) return `#${sections.get(path)}/`;
  return `#${items.get(path)?.key ?? from}${path}`;
}

function parse(hash) {
  const [, key, path = null] = /^#([\w-]+)(\/.*)?$/.exec(decodeURI(hash)) || [];
  return key in byKey ? { key, path } : { key: lobes[0].dataset.key, path: null };
}

let current = { key: null, path: null };
let ready = false;
let hashTimer = 0;

// Turntable

scene.setAttribute("aria-roledescription", "carousel");
lobes.forEach((lobe, i) => {
  lobe.setAttribute("role", "group");
  lobe.setAttribute("aria-roledescription", "slide");
  lobe.setAttribute("aria-label", `${lobe.dataset.title}, ${i + 1} of ${lobes.length}`);
});

function select(lobe) {
  for (const l of lobes) {
    const on = l === lobe;
    l.toggleAttribute("data-front", on);
    l.setAttribute("aria-hidden", String(!on));
    for (const a of l.querySelectorAll("a")) a.tabIndex = on ? 0 : -1;
  }
  if (!ready || current.path !== null) return;
  // Record the panel once the ring settles: spinning passes many panels a
  // second, and Safari throws after 100 replaceState calls in 30 seconds.
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, "", `#${lobe.dataset.key}`), 400);
}

function fireFrom(el) {
  const box = el.getBoundingClientRect();
  field.stimulate(box.left + box.width / 2, box.top + box.height / 2);
}

// The inline script in home.html already set the turntable up for the first
// paint; mark it taken over, so that script's fallback to the grid stays off.
scene.classList.add("is-ring");
scene.setAttribute("data-ready", "");
scene.querySelector(".lobes__controls").hidden = false;
const susan = createLazySusan(scene, ring, lobes, {
  reducedMotion,
  onFront(i) {
    // Every panel that passes the front fires the network, so spinning
    // quickly through the menu builds up activity. Measure before select()
    // changes the layout, so reading the box does not force a reflow.
    if (ready) fireFrom(lobes[i]);
    select(lobes[i]);
  },
});
window.addEventListener("resize", () => susan.layout());

for (const button of scene.querySelectorAll(".lobes__step")) {
  button.addEventListener("click", () => susan.spin(Number(button.dataset.step)));
}

const plainClick = (event) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0);

lobes.forEach((lobe, i) => {
  const key = lobe.dataset.key;
  lobe.addEventListener("click", (event) => {
    if (i !== susan.front) {
      event.preventDefault();
      susan.goTo(i);
      return;
    }
    const link = event.target.closest("a");
    // Modified clicks open the page in a new tab; the PDF opens in one.
    if (link && (!plainClick(event) || link.target === "_blank")) return;
    event.preventDefault();
    // A pointer press has already fired the network; keyboard activation
    // (detail 0) has no pointer, so fire from the panel itself.
    if (event.detail === 0) fireFrom(lobe);
    const example = link?.classList.contains("lobe__example") && lobe.dataset.zoom === "list";
    go(example ? hashFor(pathOf(link.href), key) : `#${key}/`);
  });
});

// The arrow keys turn the turntable from anywhere on the main screen, a
// panel per press, so quick presses add up; Home and End jump to the ends
// when focus is on it. Focus on a panel follows the panel coming to the front.
// Enter opens the front panel, unless focus is on a link or button, which
// Enter activates instead.
document.addEventListener("keydown", (event) => {
  if (current.path !== null || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  const onRing = scene.contains(document.activeElement);
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (event.key === "Enter") {
    if (event.target.closest("a, button")) return;
    const front = lobes[susan.target];
    fireFrom(front);
    go(`#${front.dataset.key}/`);
  } else if (step) susan.spin(step);
  else if (onRing && (event.key === "Home" || event.key === "End")) susan.goTo(event.key === "Home" ? 0 : lobes.length - 1);
  else return;
  event.preventDefault();
  if (onRing && document.activeElement.closest(".lobe")) lobes[susan.target].querySelector(".lobe__more").focus({ preventScroll: true });
});

// Zoom

function load(path) {
  if (frame.dataset.path === path) return;
  frame.dataset.path = path;
  frame.classList.add("is-loading");
  const url = new URL(path, location.href);
  url.searchParams.set("embed", "");
  // Replace, so pages shown in the sheet add no history of their own: the
  // hash already records each one.
  if (frame.isConnected) frame.contentWindow.location.replace(url);
  else {
    frame.src = url;
    sheet.append(frame);
  }
}

function fill({ key, path }) {
  const lobe = byKey[key];
  const atRoot = path === "/";
  const kind = atRoot ? lobe.dataset.zoom : "page";
  sectionCrumb.href = `#${key}/`;
  sectionCrumb.querySelector("span").textContent = lobe.dataset.title;
  sectionCrumb.querySelector("i").className = `crumbs__icon fas fa-${lobe.dataset.icon}`;
  if (atRoot) sectionCrumb.setAttribute("aria-current", "page");
  else sectionCrumb.removeAttribute("aria-current");
  itemCrumb.hidden = atRoot;
  if (!atRoot) itemCrumb.firstElementChild.textContent = items.get(path)?.title ?? "";

  about.hidden = kind !== "about";
  listHost.hidden = kind !== "list";
  if (kind === "list" && listHost.dataset.key !== key) {
    listHost.dataset.key = key;
    listHost.replaceChildren(lists[key].content.cloneNode(true));
  }
  frame.hidden = kind !== "page";
  if (kind === "page") load(atRoot ? pathOf(lobe.dataset.url) : path);
  if (kind !== "page") sheet.scrollTop = 0;
}

function apply(state) {
  const lobe = byKey[state.key];
  const wasZoomed = current.path !== null;
  const zoomed = state.path !== null;
  // Set the state before turning the ring, so select() sees a zoomed state
  // and does not record the panel over this hash.
  current = state;
  clearTimeout(hashTimer);
  if (lobes.indexOf(lobe) !== susan.front) susan.goTo(lobes.indexOf(lobe), { instant: true });
  root.toggleAttribute("data-zoomed", zoomed);
  zoom.hidden = !zoomed;
  page.inert = zoomed;
  colophon.inert = zoomed;
  if (zoomed) fill(state);
  if (!ready) return;
  // Keep focus in the sheet when the link that had it goes (a list giving
  // way to a page), and return it to the panel on zooming out.
  const active = document.activeElement;
  if (zoomed && (!zoom.contains(active) || active.closest("[hidden]"))) focusSheet();
  if (!zoomed && wasZoomed) lobe.querySelector(".lobe__more").focus({ preventScroll: true });
}

// Focus what scrolls, so the arrow and page keys scroll the panel: the page
// in the frame once it has loaded, otherwise the sheet itself.
function focusSheet() {
  if (!frame.hidden && frame.isConnected && !frame.classList.contains("is-loading")) frame.contentWindow.focus();
  else sheet.focus({ preventScroll: true });
}

// Zooming in or out morphs the name into the breadcrumb and the front panel
// into the sheet; the names they share are set in home.css.
function show(state) {
  const toggles = (state.path !== null) !== (current.path !== null);
  if (toggles && document.startViewTransition && !reducedMotion) document.startViewTransition(() => apply(state));
  else apply(state);
}

function go(hash) {
  if (hash === location.hash) return;
  history.pushState(null, "", hash);
  show(parse(hash));
}

window.addEventListener("popstate", () => show(parse(location.hash)));

homeCrumb.addEventListener("click", (event) => {
  if (!plainClick(event)) return;
  event.preventDefault();
  go(`#${current.key}`);
});

sectionCrumb.addEventListener("click", (event) => {
  if (!plainClick(event)) return;
  event.preventDefault();
  go(`#${current.key}/`);
});

listHost.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  // Links to other sites (a profile above the list) open as they are.
  if (!link || !plainClick(event) || link.origin !== location.origin) return;
  event.preventDefault();
  go(hashFor(pathOf(link.href), current.key));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && current.path !== null) go(`#${current.key}`);
});

// A click outside the sheet zooms out too, except on a link or button (the
// breadcrumb, the theme switch) or on the turntable, whose click may be the
// one zooming in. Inside is judged by position: while the zoom animates,
// clicks land on the root rather than on the sheet.
document.addEventListener("click", (event) => {
  if (current.path === null || !plainClick(event)) return;
  if (event.target.closest(".lobes, a, button")) return;
  const box = sheet.getBoundingClientRect();
  const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  if (!inside) go(`#${current.key}`);
});

// Pages in the sheet run site.js in embed mode, which hands their links,
// presses and Escape to this page.
window.addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  const { type, href, x, y } = event.data || {};
  if (type === "open") go(hashFor(pathOf(href), current.key));
  else if (type === "escape") go(`#${current.key}`);
  else if (type === "stimulate") {
    const box = frame.getBoundingClientRect();
    field.stimulate(box.left + x, box.top + y);
  }
});

frame.addEventListener("load", () => {
  frame.classList.remove("is-loading");
  // Hand focus to the page that just loaded, unless it is on the breadcrumb.
  if (current.path !== null && !crumbs.contains(document.activeElement)) frame.contentWindow.focus();
  const doc = frame.contentDocument;
  doc.documentElement.setAttribute("data-theme", root.getAttribute("data-theme"));
  const title = doc.querySelector(".page__title")?.textContent.trim() || doc.title;
  frame.title = title;
  if (current.path !== "/") itemCrumb.firstElementChild.textContent = title;
});

// The theme switch stays usable while zoomed; the page in the sheet follows it.
new MutationObserver(() => {
  frame.contentDocument?.documentElement.setAttribute("data-theme", root.getAttribute("data-theme"));
}).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

crumbs.hidden = false;
const initial = parse(location.hash);
select(byKey[initial.key]);
susan.goTo(lobes.indexOf(byKey[initial.key]), { instant: true });
apply(initial);
ready = true;
