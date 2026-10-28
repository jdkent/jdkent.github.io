import { createLazySusan } from "./lazy-susan.js";
import { field, reducedMotion } from "./site.js";

// Home: a turntable of panels, each showing its newest item. A panel zooms
// in place into the whole section: the name moves up into a breadcrumb and
// the panel grows into a code editor. Its explorer lists every section as a
// folder of files, one per entry, and each file opens in a tab of the sheet,
// which shows the section's list (its README), the bio, or a page. Pages open
// in the sheet too, so you never leave home. The hash
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
const ide = zoom.querySelector(".ide");
const explorer = ide.querySelector(".ide__explorer");
const tree = explorer.querySelector(".tree");
const tabBar = ide.querySelector(".ide__tabs");
const closeButton = ide.querySelector(".ide__close");
const ideBody = ide.querySelector(".ide__body");
const sash = ide.querySelector(".ide__sash");
const tabMenu = ide.querySelector(".tab-menu");
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

// A page's file name: the last part of its path, less any leading date.
const fileName = (path) => `${path.split("/").filter(Boolean).pop().replace(/^\d{4}-\d{2}-\d{2}-/, "")}.md`;

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

// The hash showing a zoomed-in state.
const hashOf = ({ key, path }) => (path === "/" ? `#${key}/` : `#${key}${path}`);

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

// Boot: every terminal types `sudo neuroscience` in step, and each then
// prints its own section, the panel at the front first. The inline script in
// home.html set data-booting for the first paint. It runs to the end however
// the turntable is turned meanwhile.

const COMMAND = "sudo neuroscience";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bootLines = lobes.map((l) => l.querySelector(".lobe__boot"));

function print(text) {
  for (const b of bootLines) b.append(Object.assign(document.createElement("p"), { className: "lobe__boot-out", textContent: text }));
}

async function boot() {
  const typed = bootLines.map((b) => b.querySelector(".lobe__boot-cmd"));
  await sleep(600);
  for (let i = 1; i <= COMMAND.length; i++) {
    for (const t of typed) t.textContent = COMMAND.slice(0, i);
    await sleep(45 + Math.random() * 55);
  }
  await sleep(260);
  print("[sudo] password for jdkent: ");
  await sleep(700);
  bootLines.forEach((b, i) => {
    b.lastElementChild.textContent += "*".repeat(8);
    b.append(Object.assign(document.createElement("p"), { className: "lobe__boot-out", textContent: `Loading ${lobes[i].dataset.title}...` }));
  });
  await sleep(500);
  // Outward from the front, both ways round.
  const n = lobes.length;
  const order = lobes.map((_, i) => i).sort((a, b) => {
    const d = (i) => Math.min(Math.abs(i - susan.front), n - Math.abs(i - susan.front));
    return d(a) - d(b);
  });
  for (const i of order) {
    lobes[i].setAttribute("data-booted", "");
    if (i === susan.front) fireFrom(lobes[i]);
    await sleep(110);
  }
  await sleep(400);
  root.removeAttribute("data-booting");
}

// Explorer: a folder per section, holding its README (the zoomed panel
// itself), a file per entry, and for the CV, the PDF. The open section's
// folder unfolds; the others fold and unfold on a click.

const folders = {};
const fileLinks = new Map();

function file(hash, name, icon, title) {
  const a = Object.assign(document.createElement("a"), { className: "tree__row tree__file", href: hash });
  if (title) a.title = title;
  a.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span></span>`;
  a.lastChild.textContent = name;
  fileLinks.set(hash, a);
  const li = document.createElement("li");
  li.append(a);
  return li;
}

for (const lobe of lobes) {
  const key = lobe.dataset.key;
  const li = Object.assign(document.createElement("li"), { className: "tree__folder" });
  const toggle = Object.assign(document.createElement("button"), { type: "button", className: "tree__row tree__toggle" });
  toggle.innerHTML = `<i class="tree__chevron fas fa-chevron-right" aria-hidden="true"></i><i class="fas fa-folder" aria-hidden="true"></i><span></span>`;
  toggle.lastChild.textContent = key;
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(toggle.getAttribute("aria-expanded") !== "true")));
  const files = document.createElement("ul");
  files.append(file(`#${key}/`, "README.md", "fas fa-circle-info", `${lobe.dataset.title}: all`));
  for (const a of lists[key]?.content.querySelectorAll(".entry__title") ?? []) {
    const path = pathOf(a.getAttribute("href"));
    files.append(file(hashFor(path, key), fileName(path), "fab fa-markdown", a.textContent.trim()));
  }
  const pdf = lobe.querySelector('a[target="_blank"]');
  if (pdf) {
    const li = file(pdf.getAttribute("href"), pdf.getAttribute("href").split("/").pop(), "fas fa-file-pdf", "Opens in a new tab");
    li.firstChild.target = "_blank";
    li.firstChild.rel = "noopener";
    files.append(li);
  }
  li.append(toggle, files);
  tree.append(li);
  folders[key] = toggle;
}

tree.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link || link.target === "_blank" || !plainClick(event)) return;
  event.preventDefault();
  go(link.getAttribute("href"));
});

// Moving to another section folds every other folder.
let shownKey = null;

function showInExplorer(state) {
  if (state.key !== shownKey) {
    for (const [key, toggle] of Object.entries(folders)) toggle.setAttribute("aria-expanded", String(key === state.key));
    shownKey = state.key;
  }
  const hash = hashOf(state);
  for (const [h, a] of fileLinks) {
    if (h === hash) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  fileLinks.get(hash)?.scrollIntoView({ block: "nearest" });
}

// Tabs: every file opened stays open until its tab is closed, across
// sections and zooming out; closing the last one zooms out, and the title
// bar's close button closes them all.

let tabs = [];

function tabLabel(hash) {
  const { key, path } = parse(hash);
  return path === "/" ? { name: "README.md", folder: key } : { name: fileName(path), folder: key, title: items.get(path)?.title };
}

function renderTabs() {
  const active = current.path === null ? null : hashOf(current);
  tabBar.replaceChildren(...tabs.map((hash) => {
    const { name, folder, title } = tabLabel(hash);
    const li = Object.assign(document.createElement("li"), { className: "ide__tab" });
    const a = Object.assign(document.createElement("a"), { className: "ide__tab-open", href: hash });
    if (title) a.title = title;
    a.innerHTML = `<i class="${name === "README.md" ? "fas fa-circle-info" : "fab fa-markdown"}" aria-hidden="true"></i><span class="ide__tab-name"></span><span class="ide__tab-folder"></span>`;
    a.querySelector(".ide__tab-name").textContent = name;
    a.querySelector(".ide__tab-folder").textContent = folder;
    if (hash === active) a.setAttribute("aria-current", "page");
    const close = Object.assign(document.createElement("button"), { type: "button", className: "ide__tab-close" });
    close.setAttribute("aria-label", `Close ${name}`);
    close.dataset.hash = hash;
    close.innerHTML = `<i class="fas fa-xmark" aria-hidden="true"></i>`;
    li.append(a, close);
    return li;
  }));
  tabBar.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Keep only the tabs `next`. If the one showing goes, `fallback` shows
// instead, or with no tabs left, the editor zooms out.
function keepTabs(next, fallback) {
  tabs = next;
  if (current.path === null || tabs.includes(hashOf(current))) renderTabs();
  else if (tabs.length) go(fallback);
  else go(`#${current.key}`);
}

function closeTab(hash) {
  const i = tabs.indexOf(hash);
  const next = tabs.filter((h) => h !== hash);
  keepTabs(next, next[Math.min(i, next.length - 1)]);
}

// The tab menu, on a right click (or the menu key) on a tab.
let menuFor = null;

function openTabMenu(hash, x, y) {
  menuFor = hash;
  const i = tabs.indexOf(hash);
  tabMenu.querySelector('[data-close="others"]').disabled = tabs.length < 2;
  tabMenu.querySelector('[data-close="right"]').disabled = i === tabs.length - 1;
  tabMenu.hidden = false;
  const box = tabMenu.getBoundingClientRect();
  tabMenu.style.left = `${Math.max(4, Math.min(x, innerWidth - box.width - 4))}px`;
  tabMenu.style.top = `${Math.max(4, Math.min(y, innerHeight - box.height - 4))}px`;
  tabMenu.querySelector("button:not(:disabled)").focus();
}

function closeTabMenu({ refocus = false } = {}) {
  if (tabMenu.hidden) return;
  tabMenu.hidden = true;
  if (refocus) tabBar.querySelector(`a[href="${CSS.escape(menuFor)}"]`)?.focus();
  menuFor = null;
}

tabBar.addEventListener("contextmenu", (event) => {
  const tab = event.target.closest(".ide__tab");
  if (!tab) return;
  event.preventDefault();
  // The menu key has no pointer position; open below the tab.
  const box = tab.getBoundingClientRect();
  const fromKey = event.button !== 2 || (event.clientX === 0 && event.clientY === 0);
  openTabMenu(tab.querySelector(".ide__tab-close").dataset.hash, fromKey ? box.left : event.clientX, fromKey ? box.bottom : event.clientY);
});

tabMenu.addEventListener("click", (event) => {
  const item = event.target.closest("button");
  if (!item) return;
  const hash = menuFor;
  const i = tabs.indexOf(hash);
  closeTabMenu();
  if (item.dataset.close === "this") closeTab(hash);
  else if (item.dataset.close === "others") keepTabs([hash], hash);
  else if (item.dataset.close === "right") keepTabs(tabs.slice(0, i + 1), hash);
  else keepTabs([]);
});

// Up and down move through the menu; Escape closes it, not the editor.
tabMenu.addEventListener("keydown", (event) => {
  const items = [...tabMenu.querySelectorAll("button:not(:disabled)")];
  const at = items.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  } else if (event.key === "Escape" || event.key === "Tab") {
    closeTabMenu({ refocus: true });
  } else return;
  event.preventDefault();
  event.stopPropagation();
});

document.addEventListener("pointerdown", (event) => {
  if (!tabMenu.contains(event.target)) closeTabMenu();
});
// A press inside the sheet's page reaches only that page; this window blurs.
window.addEventListener("blur", () => closeTabMenu());
window.addEventListener("resize", () => closeTabMenu());
tabBar.addEventListener("scroll", () => closeTabMenu());

// Explorer width: dragged by the sash at its edge, or the arrow keys on it;
// a double click restores the default. Remembered in this browser.
const EXPLORER_MIN = 160;
const EDITOR_MIN = 280;

function setExplorerWidth(width, { save = true } = {}) {
  const max = Math.max(EXPLORER_MIN, ideBody.clientWidth - EDITOR_MIN);
  const w = Math.round(Math.min(max, Math.max(EXPLORER_MIN, width)));
  ideBody.style.setProperty("--explorer-w", `${w}px`);
  sash.setAttribute("aria-valuenow", w);
  sash.setAttribute("aria-valuemin", EXPLORER_MIN);
  sash.setAttribute("aria-valuemax", Math.round(max));
  if (save) try { localStorage.setItem("explorer-width", w); } catch (e) {}
}

let stored = 0;
try { stored = Number(localStorage.getItem("explorer-width")) || 0; } catch (e) {}
if (stored) ideBody.style.setProperty("--explorer-w", `${stored}px`);

sash.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  sash.setPointerCapture(event.pointerId);
  const from = event.clientX, width = explorer.getBoundingClientRect().width;
  ideBody.classList.add("is-resizing");
  const move = (e) => setExplorerWidth(width + e.clientX - from, { save: false });
  const end = () => {
    ideBody.classList.remove("is-resizing");
    sash.removeEventListener("pointermove", move);
    setExplorerWidth(explorer.getBoundingClientRect().width);
  };
  sash.addEventListener("pointermove", move);
  sash.addEventListener("lostpointercapture", end, { once: true });
});

sash.addEventListener("keydown", (event) => {
  const by = { ArrowLeft: -16, ArrowRight: 16 }[event.key];
  if (!by) return;
  event.preventDefault();
  setExplorerWidth(explorer.getBoundingClientRect().width + by);
});

sash.addEventListener("dblclick", () => {
  ideBody.style.removeProperty("--explorer-w");
  try { localStorage.removeItem("explorer-width"); } catch (e) {}
  setExplorerWidth(explorer.getBoundingClientRect().width, { save: false });
});

tabBar.addEventListener("click", (event) => {
  const close = event.target.closest(".ide__tab-close");
  if (close) {
    closeTab(close.dataset.hash);
    return;
  }
  const link = event.target.closest("a");
  if (!link || !plainClick(event)) return;
  event.preventDefault();
  go(link.getAttribute("href"));
});

closeButton.addEventListener("click", () => keepTabs([]));

// A middle click closes a tab, as in the editor.
tabBar.addEventListener("auxclick", (event) => {
  const tab = event.target.closest(".ide__tab");
  if (event.button !== 1 || !tab) return;
  event.preventDefault();
  closeTab(tab.querySelector(".ide__tab-close").dataset.hash);
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
  if (zoomed) {
    if (!tabs.includes(hashOf(state))) tabs.push(hashOf(state));
    fill(state);
    showInExplorer(state);
  }
  renderTabs();
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

// A click outside the editor zooms out too, except on a link or button (the
// breadcrumb, the theme switch) or on the turntable, whose click may be the
// one zooming in. Inside is judged by position: while the zoom animates,
// clicks land on the root rather than on the editor.
document.addEventListener("click", (event) => {
  if (current.path === null || !plainClick(event)) return;
  if (event.target.closest(".lobes, a, button")) return;
  const box = ide.getBoundingClientRect();
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
  else if (type === "ready") shown();
  else if (type === "stimulate") {
    const box = frame.getBoundingClientRect();
    field.stimulate(box.left + x, box.top + y);
  }
});

// A page shows once its content and styles are in, which site.js reports,
// without waiting for its images and fonts; the load event is the fallback.
function shown() {
  if (!frame.classList.contains("is-loading")) return;
  frame.classList.remove("is-loading");
  // Hand focus to the page that just loaded, unless it is on the breadcrumb.
  if (current.path !== null && !crumbs.contains(document.activeElement)) frame.contentWindow.focus();
  const doc = frame.contentDocument;
  doc.documentElement.setAttribute("data-theme", root.getAttribute("data-theme"));
  const title = doc.querySelector(".page__title")?.textContent.trim() || doc.title;
  frame.title = title;
  if (current.path !== "/") itemCrumb.firstElementChild.textContent = title;
}

frame.addEventListener("load", shown);

// The theme switch stays usable while zoomed; the page in the sheet follows it.
new MutationObserver(() => {
  frame.contentDocument?.documentElement.setAttribute("data-theme", root.getAttribute("data-theme"));
}).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

crumbs.hidden = false;
explorer.hidden = false;
tabBar.hidden = false;
sash.hidden = false;
const initial = parse(location.hash);
select(byKey[initial.key]);
susan.goTo(lobes.indexOf(byKey[initial.key]), { instant: true });
apply(initial);
ready = true;

if (root.hasAttribute("data-booting")) boot();
