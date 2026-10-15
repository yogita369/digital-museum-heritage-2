// Digital Museum and Heritage Information System - Cloudflare Worker
//
// One Worker does two jobs:
//   1. Serves the web interface (index.html, style.css, script.js). Terraform
//      uploads those files into the SITE_ASSETS KV namespace.
//   2. Exposes a REST API that stores artifact records in ARTIFACTS_KV.
//
// Bindings (all created by Terraform, see terraform/modules/worker/main.tf):
//   ARTIFACTS_KV     KV namespace  - artifact records
//   SITE_ASSETS      KV namespace  - frontend files
//   APP_CONFIG       JSON          - { environment, museumName, version }
//   CURATOR_API_KEY  secret        - required for create / update / delete

const CATEGORIES = [
  "Sculpture",
  "Painting",
  "Manuscript",
  "Coin",
  "Textile",
  "Pottery",
  "Weapon",
  "Jewellery",
  "Inscription",
];
const STATUSES = ["On Display", "In Storage", "Under Restoration", "On Loan"];
const CONDITIONS = ["Excellent", "Good", "Fair", "Needs Restoration"];
const SORT_OPTIONS = ["created", "name", "year", "id"];

const ARTIFACT_PREFIX = "artifact:";
const COUNTER_KEY = "meta:next_id";
const FIRST_ID = 1001;
const ID_PATTERN = /^ART-\d+$/;

const STATIC_FILES = {
  "/": { key: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { key: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { key: "style.css", type: "text/css; charset=utf-8" },
  "/script.js": { key: "script.js", type: "application/javascript; charset=utf-8" },
};

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      if (err instanceof HttpError) {
        const body = { error: err.message };
        if (err.details) body.details = err.details;
        return json(body, err.status);
      }
      console.error("Unhandled error:", err);
      return json({ error: "Internal server error" }, 500);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  const config = appConfig(env);

  if (!path.startsWith("/api")) {
    if (method !== "GET") throw new HttpError(405, "Method not allowed");
    return serveStatic(path, env);
  }

  if (path === "/api/health") {
    allow(method, ["GET"]);
    return json({
      status: "ok",
      environment: config.environment,
      version: config.version,
      timestamp: new Date().toISOString(),
    });
  }

  if (path === "/api/config") {
    allow(method, ["GET"]);
    return json({
      ...config,
      categories: CATEGORIES,
      statuses: STATUSES,
      conditions: CONDITIONS,
    });
  }

  if (path === "/api/auth") {
    allow(method, ["GET"]);
    requireCurator(request, env);
    return json({ authenticated: true, role: "curator" });
  }

  if (path === "/api/stats") {
    allow(method, ["GET"]);
    return json(buildStats(await listAllArtifacts(env)));
  }

  if (path === "/api/artifacts") {
    allow(method, ["GET", "POST"]);
    if (method === "GET") return listArtifacts(url, env);
    requireCurator(request, env);
    return createArtifact(request, env);
  }

  const match = path.match(/^\/api\/artifacts\/([^/]+)$/);
  if (match) {
    allow(method, ["GET", "PUT", "DELETE"]);
    const id = normaliseId(match[1]);
    if (method === "GET") return json(await getArtifactOr404(env, id));
    requireCurator(request, env);
    if (method === "PUT") return updateArtifact(request, env, id);
    return deleteArtifact(env, id);
  }

  throw new HttpError(404, "API endpoint not found");
}

// ---------------------------------------------------------------- static files

async function serveStatic(path, env) {
  const file = STATIC_FILES[path];
  if (!file) throw new HttpError(404, "Page not found");
  const body = await env.SITE_ASSETS.get(file.key);
  if (body === null) {
    throw new HttpError(404, `Static file "${file.key}" not found in SITE_ASSETS`);
  }
  return new Response(body, {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ---------------------------------------------------------------- API handlers

async function listArtifacts(url, env) {
  const params = url.searchParams;
  const sort = params.get("sort") || "created";
  if (!SORT_OPTIONS.includes(sort)) {
    throw new HttpError(400, `sort must be one of: ${SORT_OPTIONS.join(", ")}`);
  }
  const artifacts = filterArtifacts(await listAllArtifacts(env), {
    search: params.get("search"),
    category: params.get("category"),
    status: params.get("status"),
    condition: params.get("condition"),
    era: params.get("era"),
  });
  sortArtifacts(artifacts, sort);
  return json({ count: artifacts.length, artifacts });
}

async function createArtifact(request, env) {
  const fields = validateArtifact(await readJson(request), { partial: false });
  const id = await nextArtifactId(env);
  const now = new Date().toISOString();
  const artifact = { id, ...fields, createdAt: now, updatedAt: now };
  await env.ARTIFACTS_KV.put(ARTIFACT_PREFIX + id, JSON.stringify(artifact));
  return json({ message: "Artifact successfully created", artifact }, 201, {
    Location: `/api/artifacts/${id}`,
  });
}

async function updateArtifact(request, env, id) {
  const existing = await getArtifactOr404(env, id);
  const changes = validateArtifact(await readJson(request), { partial: true });
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, "Request body contains no updatable fields");
  }
  const artifact = {
    ...existing,
    ...changes,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await env.ARTIFACTS_KV.put(ARTIFACT_PREFIX + id, JSON.stringify(artifact));
  return json({ message: "Artifact successfully updated", artifact });
}

async function deleteArtifact(env, id) {
  await getArtifactOr404(env, id);
  await env.ARTIFACTS_KV.delete(ARTIFACT_PREFIX + id);
  return json({ message: "Artifact removed successfully", id });
}

// ---------------------------------------------------------------- KV access

async function getArtifactOr404(env, id) {
  const artifact = await env.ARTIFACTS_KV.get(ARTIFACT_PREFIX + id, "json");
  if (!artifact) throw new HttpError(404, `Artifact ${id} not found`);
  return artifact;
}

async function listAllArtifacts(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.ARTIFACTS_KV.list({ prefix: ARTIFACT_PREFIX, cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const records = await Promise.all(keys.map((key) => env.ARTIFACTS_KV.get(key, "json")));
  return records.filter(Boolean);
}

async function nextArtifactId(env) {
  // KV has no atomic increment. A counter is fine for one museum's curators;
  // a production system with many concurrent writers would use D1 or a
  // Durable Object instead.
  const stored = parseInt(await env.ARTIFACTS_KV.get(COUNTER_KEY), 10);
  const next = Number.isFinite(stored) ? stored : FIRST_ID;
  await env.ARTIFACTS_KV.put(COUNTER_KEY, String(next + 1));
  return `ART-${next}`;
}

// ---------------------------------------------------------------- domain logic

function validateArtifact(input, { partial }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const errors = [];
  const out = {};
  const has = (field) => input[field] !== undefined;

  const text = (field, { required = false, min = 0, max }) => {
    if (!has(field)) {
      if (!partial) {
        if (required) errors.push(`${field} is required`);
        else out[field] = "";
      }
      return;
    }
    if (typeof input[field] !== "string") {
      errors.push(`${field} must be a string`);
      return;
    }
    const value = input[field].trim();
    if (required && value.length === 0) errors.push(`${field} must not be empty`);
    else if (value.length < min) errors.push(`${field} must be at least ${min} characters`);
    else if (value.length > max) errors.push(`${field} must be at most ${max} characters`);
    else out[field] = value;
  };

  const choice = (field, allowed, fallback) => {
    if (!has(field)) {
      if (!partial) {
        if (fallback === undefined) errors.push(`${field} is required`);
        else out[field] = fallback;
      }
      return;
    }
    if (!allowed.includes(input[field])) {
      errors.push(`${field} must be one of: ${allowed.join(", ")}`);
      return;
    }
    out[field] = input[field];
  };

  text("name", { required: true, min: 2, max: 120 });
  choice("category", CATEGORIES);
  text("era", { required: true, max: 80 });
  text("origin", { max: 120 });
  text("gallery", { max: 60 });
  choice("condition", CONDITIONS, "Good");
  choice("status", STATUSES, "In Storage");
  text("description", { max: 2000 });

  if (has("acquisitionYear") && input.acquisitionYear !== null && input.acquisitionYear !== "") {
    const year = Number(input.acquisitionYear);
    const maxYear = new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 1500 || year > maxYear) {
      errors.push(`acquisitionYear must be a whole number between 1500 and ${maxYear}`);
    } else {
      out.acquisitionYear = year;
    }
  } else if (has("acquisitionYear") || !partial) {
    out.acquisitionYear = null;
  }

  if (has("imageUrl") && input.imageUrl !== "") {
    if (typeof input.imageUrl !== "string" || !/^https?:\/\/\S+$/i.test(input.imageUrl.trim())) {
      errors.push("imageUrl must be an http(s) URL");
    } else {
      out.imageUrl = input.imageUrl.trim();
    }
  } else if (has("imageUrl") || !partial) {
    out.imageUrl = "";
  }

  if (errors.length) throw new HttpError(400, "Validation failed", errors);
  return out;
}

function filterArtifacts(artifacts, { search, category, status, condition, era }) {
  const needle = (search || "").trim().toLowerCase();
  const eraNeedle = (era || "").trim().toLowerCase();
  return artifacts.filter((a) => {
    if (category && a.category !== category) return false;
    if (status && a.status !== status) return false;
    if (condition && a.condition !== condition) return false;
    if (eraNeedle && !(a.era || "").toLowerCase().includes(eraNeedle)) return false;
    if (needle) {
      const haystack = [a.id, a.name, a.era, a.origin, a.gallery, a.description, a.category]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

function sortArtifacts(artifacts, sort) {
  const idNumber = (a) => parseInt(a.id.slice(4), 10);
  const comparators = {
    created: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || idNumber(b) - idNumber(a),
    name: (a, b) => a.name.localeCompare(b.name),
    year: (a, b) => (a.acquisitionYear ?? Infinity) - (b.acquisitionYear ?? Infinity),
    id: (a, b) => idNumber(a) - idNumber(b),
  };
  return artifacts.sort(comparators[sort]);
}

function buildStats(artifacts) {
  const countBy = (field, keys) => {
    const counts = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const a of artifacts) counts[a[field]] = (counts[a[field]] || 0) + 1;
    return counts;
  };
  return {
    total: artifacts.length,
    byStatus: countBy("status", STATUSES),
    byCategory: countBy("category", CATEGORIES),
    byCondition: countBy("condition", CONDITIONS),
    galleries: new Set(artifacts.map((a) => a.gallery).filter(Boolean)).size,
  };
}

// ---------------------------------------------------------------- helpers

function appConfig(env) {
  const config = env.APP_CONFIG || {};
  return {
    museumName: config.museumName || "Digital Museum",
    environment: config.environment || "unknown",
    version: config.version || "unknown",
  };
}

function requireCurator(request, env) {
  if (!env.CURATOR_API_KEY) {
    throw new HttpError(503, "Curator access is not configured for this environment");
  }
  const supplied = request.headers.get("X-Curator-Key") || "";
  if (!constantTimeEqual(supplied, env.CURATOR_API_KEY)) {
    throw new HttpError(401, "A valid curator key is required for this action");
  }
}

function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function normaliseId(raw) {
  const id = decodeURIComponent(raw).trim().toUpperCase();
  if (!ID_PATTERN.test(id)) throw new HttpError(404, `Artifact ${id} not found`);
  return id;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function allow(method, methods) {
  if (!methods.includes(method)) throw new HttpError(405, "Method not allowed");
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}
