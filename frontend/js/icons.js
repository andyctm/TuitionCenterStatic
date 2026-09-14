/* Shared icon set — hand-authored, single stroke weight, 20x20 viewBox. */
const ICONS = {
  dashboard: '<path d="M3 3h7v7H3V3Zm11 0h7v4h-7V3ZM3 13h7v4H3v-4Zm11-3h7v7h-7v-7Z"/>',
  branches: '<path d="M6 3v6m8-6v3m-8 3a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4M6 17h.01M14 6h.01"/><circle cx="6" cy="17" r="1.4"/><circle cx="14" cy="6" r="1.4"/><circle cx="6" cy="3" r="1.4"/>',
  users: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 6c0-2.8-2.2-5-5-5H7a5 5 0 0 0-5 5"/><path d="M16.5 5a3 3 0 0 1 0 6M20 17a4.2 4.2 0 0 0-3.5-4.15"/>',
  courses: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H15v13H5.5A1.5 1.5 0 0 0 4 18.5v-13Z"/><path d="M15 4h1.5A1.5 1.5 0 0 1 18 5.5v13a1.5 1.5 0 0 0-1.5-1.5H15"/>',
  batches: '<rect x="3" y="4" width="14" height="14" rx="2"/><path d="M3 9h14M7 2v4M13 2v4"/>',
  reports: '<path d="M4 18V9m6 9V4m6 14v-7"/><path d="M2 18h16"/>',
  audit: '<path d="M10 3l7 3v5c0 4.4-3 7-7 8-4-1-7-3.6-7-8V6l7-3Z"/><path d="M7.5 10.2l1.8 1.8 3.2-3.6"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2m0 11v2M4.2 4.2l1.4 1.4m8.8 8.8 1.4 1.4M2.5 10h2m11 0h2M4.2 15.8l1.4-1.4m8.8-8.8 1.4-1.4"/>',
  enrollment: '<path d="M8 3H5.5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M14 3h4m-2-2v4"/><path d="M7 8h4M7 11.5h6M7 15h4"/>',
  attendance: '<path d="M6 3v2M14 3v2"/><rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M7 10.5l2 2 4-4.2"/>',
  home: '<path d="M4 9.5 10 4l6 5.5V17a1 1 0 0 1-1 1h-3v-5H8v5H5a1 1 0 0 1-1-1V9.5Z"/>',
  schedule: '<rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4"/><path d="M7 11.5h2M11 11.5h2M7 14.5h2"/>',
  search: '<circle cx="9" cy="9" r="5.5"/><path d="m17 17-3.4-3.4"/>',
  bell: '<path d="M10 3a4.5 4.5 0 0 0-4.5 4.5v2.7L4 13.5h12l-1.5-3.3V7.5A4.5 4.5 0 0 0 10 3Z"/><path d="M8.3 16a1.8 1.8 0 0 0 3.4 0"/>',
  chevronDown: '<path d="m5.5 8 4.5 4 4.5-4"/>',
  chevronLeft: '<path d="M12.5 4.5 7 10l5.5 5.5"/>',
  menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
  mapPin: '<path d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="10" cy="8" r="2.2"/>',
  check: '<path d="M4 10.5 8 14l8-8.5"/>',
  checkCircle: '<circle cx="10" cy="10" r="7.25"/><path d="m6.7 10.2 2.3 2.3 4.3-4.6"/>',
  xCircle: '<circle cx="10" cy="10" r="7.25"/><path d="m7.3 7.3 5.4 5.4M12.7 7.3l-5.4 5.4"/>',
  dot: '<circle cx="10" cy="10" r="3.5"/>',
  minusCircle: '<circle cx="10" cy="10" r="7.25"/><path d="M6.5 10h7"/>',
  alertTriangle: '<path d="M10 3.5 18 17H2L10 3.5Z"/><path d="M10 8.5v3.2M10 14.2h.01"/>',
  info: '<circle cx="10" cy="10" r="7.25"/><path d="M10 9v4.5M10 6.6h.01"/>',
  logout: '<path d="M8 3H5.5A1.5 1.5 0 0 0 4 4.5v11A1.5 1.5 0 0 0 5.5 17H8"/><path d="M13 14l4-4-4-4M17 10H8"/>',
  x: '<path d="m5 5 10 10M15 5 5 15"/>',
  edit: '<path d="M12.5 3.5 16 7l-9 9-4 1 1-4 8.5-9.5Z"/>',
  trash: '<path d="M4 5.5h12M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M6 5.5 6.7 16a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.5"/>',
};

function renderIcons(root) {
  (root || document).querySelectorAll("i[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    const path = ICONS[name];
    if (!path) return;
    const extraClass = el.getAttribute("data-class") || "";
    const size = el.getAttribute("data-size");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", `icon ${extraClass}`.trim());
    if (size) { svg.style.width = size; svg.style.height = size; }
    svg.innerHTML = path;
    el.replaceWith(svg);
  });
}

document.addEventListener("DOMContentLoaded", () => renderIcons(document));
