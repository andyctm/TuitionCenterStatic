/* Shared interactivity for the TCMS static mockups — visual state only, no persistence. */

function initMobileNav() {
  const toggle = document.querySelector("[data-menu-toggle]");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });
  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("nav-open")) return;
    if (e.target.closest(".sidebar") || e.target.closest("[data-menu-toggle]")) return;
    document.body.classList.remove("nav-open");
  });
}

function initTabStrip() {
  document.querySelectorAll("[data-tab-strip]").forEach((strip) => {
    const group = strip.getAttribute("data-tab-strip");
    strip.querySelectorAll("button[data-tab-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        strip.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const target = btn.getAttribute("data-tab-target");
        document.querySelectorAll(`[data-tab-panel][data-tab-group="${group}"]`).forEach((panel) => {
          panel.hidden = panel.getAttribute("data-tab-panel") !== target;
        });
      });
    });
  });
}

function updateSaveBar() {
  const rows = document.querySelectorAll("[data-roster-row]");
  const bar = document.querySelector("[data-save-bar]");
  if (!rows.length || !bar) return;
  const total = rows.length;
  const marked = Array.from(rows).filter((r) => r.querySelector(".segmented button.is-selected")).length;
  bar.querySelector("[data-progress-count]").textContent = `${marked} of ${total} marked`;
  bar.querySelector("[data-save-btn]").disabled = marked < total;
}

function initSegmented() {
  document.querySelectorAll("[data-roster-row]").forEach((row) => {
    const seg = row.querySelector(".segmented");
    const remarks = row.querySelector("[data-remarks]");
    if (!seg) return;
    seg.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        seg.querySelectorAll("button").forEach((b) => {
          b.classList.remove("is-selected");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-selected");
        btn.setAttribute("aria-pressed", "true");
        const status = btn.getAttribute("data-status");
        if (remarks) remarks.hidden = status === "present";
        updateSaveBar();
      });
    });
  });
  updateSaveBar();
}

function applyTableFilters(panel) {
  const tbody = panel.querySelector("table tbody");
  if (!tbody) return;
  const searchInput = panel.querySelector("[data-filter-search]");
  const term = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const selectFilters = [];
  panel.querySelectorAll("select[data-filter-select]").forEach((sel) => {
    const option = sel.options[sel.selectedIndex];
    const raw = option ? option.textContent : "";
    // Options may be prefixed like "Status: Active" — the value is the part after the colon.
    const value = (raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : raw).trim();
    if (value && value.toLowerCase() !== "all") {
      selectFilters.push({ column: sel.getAttribute("data-filter-select"), term: value.toLowerCase() });
    }
  });
  let visibleCount = 0;
  tbody.querySelectorAll("tr").forEach((row) => {
    if (row.hasAttribute("data-filter-empty")) return;
    const rowText = row.textContent.toLowerCase();
    let show = !term || rowText.includes(term);
    for (const filter of selectFilters) {
      if (!show) break;
      const cell = row.querySelector(`[data-label="${filter.column}"]`);
      const rowAttr = row.getAttribute("data-filter-" + filter.column.toLowerCase().replace(/\s+/g, "-"));
      const haystack = cell
        ? `${cell.getAttribute("data-filter-value") || ""} ${cell.textContent}`
        : rowAttr || rowText;
      show = haystack.toLowerCase().includes(filter.term);
    }
    row.hidden = !show;
    if (show) visibleCount += 1;
  });
  let emptyRow = tbody.querySelector("[data-filter-empty]");
  if (!visibleCount) {
    if (!emptyRow) {
      emptyRow = document.createElement("tr");
      emptyRow.setAttribute("data-filter-empty", "");
      const td = document.createElement("td");
      td.className = "cell-secondary";
      td.colSpan = panel.querySelectorAll("thead th").length || 1;
      td.textContent = "No rows match the current search or filters.";
      emptyRow.appendChild(td);
      tbody.appendChild(emptyRow);
    }
    emptyRow.hidden = false;
  } else if (emptyRow) {
    emptyRow.hidden = true;
  }
}

/* Re-applies filters on every [data-filter-panel] — call after re-rendering table rows. */
function tcmsApplyTableFilters() {
  document.querySelectorAll("[data-filter-panel]").forEach(applyTableFilters);
}

function initTableFilters() {
  document.querySelectorAll("[data-filter-panel]").forEach((panel) => {
    const search = panel.querySelector("[data-filter-search]");
    if (search) search.addEventListener("input", () => applyTableFilters(panel));
    panel.querySelectorAll("select[data-filter-select]").forEach((sel) => {
      sel.addEventListener("change", () => applyTableFilters(panel));
    });
  });
}

function initModals() {
  document.querySelectorAll("[data-open-modal]").forEach((opener) => {
    opener.addEventListener("click", () => {
      const dialog = document.getElementById(opener.getAttribute("data-open-modal"));
      if (dialog && dialog.showModal) dialog.showModal();
    });
  });
  document.querySelectorAll("[data-close-modal]").forEach((closer) => {
    closer.addEventListener("click", () => {
      const dialog = closer.closest("dialog");
      if (dialog) dialog.close();
    });
  });
}

function initSeatPicker() {
  const options = document.querySelectorAll("[data-seat-option]");
  const errorBox = document.querySelector("[data-seat-error]");
  const confirmBtn = document.querySelector("[data-enroll-confirm]");
  options.forEach((opt) => {
    opt.addEventListener("click", () => {
      const radio = opt.querySelector("input[type=radio]");
      if (opt.classList.contains("is-full")) {
        if (errorBox) errorBox.hidden = false;
        return;
      }
      if (errorBox) errorBox.hidden = true;
      options.forEach((o) => o.classList.remove("is-checked"));
      opt.classList.add("is-checked");
      if (radio) radio.checked = true;
      if (confirmBtn) confirmBtn.disabled = false;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initTabStrip();
  initSegmented();
  initModals();
  initSeatPicker();
  initTableFilters();
});
