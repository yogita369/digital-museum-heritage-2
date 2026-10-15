// Digital Museum and Heritage Information System - browser script.
// Talks to the Worker's REST API (/api/...) and renders the collection.

"use strict";

const state = {
  config: null,
  artifacts: [],
  view: "cards",
  curatorKey: readSession("curatorKey"),
  editingId: null,
};

const $ = (selector) => document.querySelector(selector);

// ---------------------------------------------------------------- API client

async function api(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (state.curatorKey) headers["X-Curator-Key"] = state.curatorKey;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && state.curatorKey && method !== "GET") setCurator(null);
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.details = data.details;
    throw error;
  }
  return data;
}

// ---------------------------------------------------------------- start-up

document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  setCurator(state.curatorKey);
  try {
    await loadConfig();
    await refresh();
  } catch (err) {
    showToast(`Could not reach the museum API: ${err.message}`, true);
  }
});

async function loadConfig() {
  const config = await api("/api/config");
  state.config = config;

  $("#museum-name").textContent = config.museumName;
  const badge = $("#env-badge");
  badge.textContent = config.environment;
  badge.className = `env-badge env-${config.environment}`;
  $("#app-version").textContent = `v${config.version}`;
  document.title = `${config.museumName} · Digital Museum`;

  fillSelect($("#filter-category"), config.categories, true);
  fillSelect($("#filter-status"), config.statuses, true);
  const form = $("#artifact-form");
  fillSelect(form.elements.category, config.categories);
  fillSelect(form.elements.condition, config.conditions);
  fillSelect(form.elements.status, config.statuses);
}

function fillSelect(select, values, keepFirst = false) {
  const first = keepFirst ? select.options[0] : null;
  select.replaceChildren(...(first ? [first] : []));
  for (const value of values) select.add(new Option(value, value));
}

async function refresh() {
  const params = new URLSearchParams();
  const search = $("#search").value.trim();
  if (search) params.set("search", search);
  if ($("#filter-category").value) params.set("category", $("#filter-category").value);
  if ($("#filter-status").value) params.set("status", $("#filter-status").value);
  params.set("sort", $("#sort").value);

  const [list, stats] = await Promise.all([api(`/api/artifacts?${params}`), api("/api/stats")]);
  state.artifacts = list.artifacts;
  renderStats(stats);
  renderArtifacts();
}

// ---------------------------------------------------------------- rendering

function renderStats(stats) {
  const tiles = [
    ["Total artifacts", stats.total, "var(--gold)"],
    ["On Display", stats.byStatus["On Display"], "var(--display)"],
    ["In Storage", stats.byStatus["In Storage"], "var(--storage)"],
    ["Under Restoration", stats.byStatus["Under Restoration"], "var(--restoration)"],
    ["On Loan", stats.byStatus["On Loan"], "var(--loan)"],
  ];
  $("#stat-tiles").innerHTML = tiles
    .map(
      ([label, value, accent]) =>
        `<div class="tile" style="--accent:${accent}"><div class="value">${value ?? 0}</div><div class="label">${label}</div></div>`,
    )
    .join("");

  const entries = Object.entries(stats.byCategory).filter(([, n]) => n > 0);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  $("#category-bars").innerHTML =
    `<h3>By category</h3>` +
    (entries.length
      ? entries
          .sort((a, b) => b[1] - a[1])
          .map(
            ([name, n]) =>
              `<div class="bar-row"><span>${esc(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div><span class="bar-count">${n}</span></div>`,
          )
          .join("")
      : `<p class="hint">No artifacts catalogued yet.</p>`);
}

function renderArtifacts() {
  const items = state.artifacts;
  $("#result-count").textContent = `${items.length} artifact${items.length === 1 ? "" : "s"} shown`;
  $("#empty").hidden = items.length > 0;
  $("#cards").hidden = state.view !== "cards" || items.length === 0;
  $("#table-wrap").hidden = state.view !== "table" || items.length === 0;

  $("#cards").innerHTML = items.map(cardHtml).join("");
  $("#table-body").innerHTML = items.map(rowHtml).join("");
}

function cardHtml(a) {
  // The letter placeholder stays underneath; if the image fails to load it is hidden and the letter shows.
  const media =
    esc(a.name.charAt(0).toUpperCase()) +
    (a.imageUrl ? `<img src="${esc(a.imageUrl)}" alt="${esc(a.name)}" loading="lazy" onerror="this.hidden = true" />` : "");
  return `
    <article class="card">
      <div class="card-media" data-action="view" data-id="${esc(a.id)}">${media}</div>
      <div class="card-body">
        <span class="card-id">${esc(a.id)}</span>
        <h3 data-action="view" data-id="${esc(a.id)}">${esc(a.name)}</h3>
        <span class="card-era">${esc(a.era)}</span>
        <div class="card-meta">
          <span class="chip">${esc(a.category)}</span>
          ${statusHtml(a.status)}
          ${a.gallery ? `<span class="chip">${esc(a.gallery)}</span>` : ""}
        </div>
      </div>
      <div class="card-actions curator-only">
        <select data-action="status" data-id="${esc(a.id)}" aria-label="Change status of ${esc(a.name)}">
          ${state.config.statuses.map((s) => `<option${s === a.status ? " selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(a.id)}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${esc(a.id)}">Delete</button>
      </div>
    </article>`;
}

function rowHtml(a) {
  return `
    <tr>
      <td>${esc(a.id)}</td>
      <td><button type="button" class="link" data-action="view" data-id="${esc(a.id)}">${esc(a.name)}</button></td>
      <td>${esc(a.category)}</td>
      <td>${esc(a.era)}</td>
      <td>${esc(a.gallery || "-")}</td>
      <td class="${conditionClass(a.condition)}">${esc(a.condition)}</td>
      <td>${statusHtml(a.status)}</td>
      <td>${formatDate(a.createdAt)}</td>
      <td class="curator-only">
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(a.id)}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${esc(a.id)}">Delete</button>
        </div>
      </td>
    </tr>`;
}

function statusHtml(status) {
  return `<span class="status status-${slug(status)}">${esc(status)}</span>`;
}

function conditionClass(condition) {
  return condition === "Needs Restoration" ? "condition-needs-restoration" : "";
}

function showDetail(id) {
  const a = state.artifacts.find((x) => x.id === id);
  if (!a) return;
  const rows = [
    ["Artifact ID", a.id],
    ["Category", a.category],
    ["Era / period", a.era],
    ["Origin", a.origin || "-"],
    ["Gallery", a.gallery || "-"],
    ["Condition", a.condition],
    ["Acquisition year", a.acquisitionYear ?? "-"],
    ["Catalogued", formatDate(a.createdAt)],
    ["Last updated", formatDate(a.updatedAt)],
  ];
  $("#detail-body").innerHTML = `
    ${a.imageUrl ? `<div class="detail-media"><img src="${esc(a.imageUrl)}" alt="${esc(a.name)}" onerror="this.parentElement.hidden = true" /></div>` : ""}
    <h2>${esc(a.name)}</h2>
    ${statusHtml(a.status)}
    <dl class="detail-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(String(v))}</dd>`).join("")}</dl>
    ${a.description ? `<p class="detail-desc">${esc(a.description)}</p>` : ""}`;
  const dialog = $("#detail-dialog");
  dialog.showModal();
  dialog.scrollTop = 0; // showModal focuses the Close button, which would scroll a tall dialog to the bottom

}

// ---------------------------------------------------------------- create / update / delete

function openForm(id = null) {
  const form = $("#artifact-form");
  form.reset();
  $("#form-error").textContent = "";
  state.editingId = id;

  const artifact = id ? state.artifacts.find((x) => x.id === id) : null;
  $("#form-title").textContent = artifact ? `Edit ${artifact.id}` : "Add artifact";
  $("#form-submit").textContent = artifact ? "Save changes" : "Save artifact";
  if (artifact) {
    for (const field of ["name", "category", "era", "origin", "gallery", "condition", "status", "acquisitionYear", "imageUrl", "description"]) {
      form.elements[field].value = artifact[field] ?? "";
    }
  } else {
    form.elements.condition.value = "Good";
    form.elements.status.value = "In Storage";
  }
  $("#artifact-dialog").showModal();
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  data.acquisitionYear = data.acquisitionYear === "" ? null : Number(data.acquisitionYear);

  try {
    if (state.editingId) {
      await api(`/api/artifacts/${state.editingId}`, { method: "PUT", body: data });
      showToast("Artifact updated successfully");
    } else {
      const { artifact } = await api("/api/artifacts", { method: "POST", body: data });
      showToast(`Artifact ${artifact.id} successfully created`);
    }
    $("#artifact-dialog").close();
    await refresh();
  } catch (err) {
    $("#form-error").textContent = err.details ? err.details.join("\n") : err.message;
  }
}

async function changeStatus(id, status) {
  try {
    await api(`/api/artifacts/${id}`, { method: "PUT", body: { status } });
    showToast(`${id}: status changed to "${status}"`);
    await refresh();
  } catch (err) {
    showToast(err.message, true);
    await refresh();
  }
}

async function removeArtifact(id) {
  const a = state.artifacts.find((x) => x.id === id);
  if (!confirm(`Remove ${id}${a ? ` - ${a.name}` : ""} from the collection?`)) return;
  try {
    await api(`/api/artifacts/${id}`, { method: "DELETE" });
    showToast(`Artifact ${id} removed successfully`);
    await refresh();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ---------------------------------------------------------------- curator session

function setCurator(key) {
  state.curatorKey = key;
  writeSession("curatorKey", key);
  document.body.classList.toggle("is-curator", Boolean(key));
  $("#curator-btn").textContent = key ? "Log out (curator)" : "Curator login";
}

async function submitLogin(event) {
  event.preventDefault();
  const key = $("#login-key").value;
  try {
    const res = await fetch("/api/auth", { headers: { "X-Curator-Key": key } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Login failed");
    setCurator(key);
    $("#login-dialog").close();
    showToast("Logged in as curator");
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
}

// ---------------------------------------------------------------- events

function bindEvents() {
  let searchTimer;
  $("#search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refresh().catch(reportError), 250);
  });
  for (const id of ["#filter-category", "#filter-status", "#sort"]) {
    $(id).addEventListener("change", () => refresh().catch(reportError));
  }

  document.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b === btn));
      renderArtifacts();
    }),
  );

  $("#add-btn").addEventListener("click", () => openForm());
  $("#artifact-form").addEventListener("submit", submitForm);
  $("#login-form").addEventListener("submit", submitLogin);

  $("#curator-btn").addEventListener("click", () => {
    if (state.curatorKey) {
      setCurator(null);
      showToast("Logged out");
      renderArtifacts();
      return;
    }
    $("#login-form").reset();
    $("#login-error").textContent = "";
    $("#login-dialog").showModal();
  });

  document.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => btn.closest("dialog").close()),
  );

  // One delegated listener handles the buttons inside cards and table rows.
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target || target.tagName === "SELECT") return;
    const { action, id } = target.dataset;
    if (action === "view") showDetail(id);
    if (action === "edit") openForm(id);
    if (action === "delete") removeArtifact(id);
  });
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.action === "status") changeStatus(target.dataset.id, target.value);
  });
}

// ---------------------------------------------------------------- utilities

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function reportError(err) {
  showToast(err.message, true);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}
