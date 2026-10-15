// Tests for application/worker.js. The KV namespaces are replaced with an
// in-memory mock, so these run in CI without any Cloudflare credentials.
// Run with: node --test tests/

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../application/worker.js";
import { MemoryKV } from "../scripts/memory-kv.mjs";

const KEY = "test-curator-key-123";
let env;

beforeEach(() => {
  env = {
    ARTIFACTS_KV: new MemoryKV(),
    SITE_ASSETS: new MemoryKV({ "index.html": "<h1>Museum</h1>", "style.css": "body{}" }),
    APP_CONFIG: { environment: "test", museumName: "Test Heritage Museum", version: "9.9.9" },
    CURATOR_API_KEY: KEY,
  };
});

function call(method, path, { body, key = KEY } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers["X-Curator-Key"] = key;
  const request = new Request(`https://museum.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return worker.fetch(request, env);
}

const nataraja = {
  name: "Bronze Nataraja",
  category: "Sculpture",
  era: "Chola Dynasty, 11th century CE",
  origin: "Thanjavur",
  gallery: "Gallery A",
  status: "On Display",
  acquisitionYear: 1958,
};

describe("Test Case 1 - create artifact", () => {
  test("POST /api/artifacts creates ART-1001 with defaults", async () => {
    const res = await call("POST", "/api/artifacts", { body: nataraja });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("Location"), "/api/artifacts/ART-1001");
    const { message, artifact } = await res.json();
    assert.equal(message, "Artifact successfully created");
    assert.equal(artifact.id, "ART-1001");
    assert.equal(artifact.condition, "Good");
    assert.equal(artifact.description, "");
    assert.ok(artifact.createdAt);
    assert.ok(await env.ARTIFACTS_KV.get("artifact:ART-1001"));
  });

  test("IDs increment", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    const res = await call("POST", "/api/artifacts", { body: { ...nataraja, name: "Second" } });
    assert.equal((await res.json()).artifact.id, "ART-1002");
  });

  test("missing required fields are rejected", async () => {
    const res = await call("POST", "/api/artifacts", { body: { category: "Painting" } });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.details.includes("name is required"));
    assert.ok(body.details.includes("era is required"));
  });

  test("invalid enum, year and URL are rejected", async () => {
    const res = await call("POST", "/api/artifacts", {
      body: { ...nataraja, category: "Spaceship", acquisitionYear: 3000, imageUrl: "javascript:alert(1)" },
    });
    assert.equal(res.status, 400);
    const { details } = await res.json();
    assert.equal(details.length, 3);
  });

  test("malformed JSON is rejected", async () => {
    const res = await call("POST", "/api/artifacts", { body: "{not json" });
    assert.equal(res.status, 400);
  });
});

describe("Test Case 2 - read artifacts", () => {
  test("GET one and GET all", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    const one = await call("GET", "/api/artifacts/art-1001", { key: null });
    assert.equal(one.status, 200);
    assert.equal((await one.json()).name, "Bronze Nataraja");

    const all = await call("GET", "/api/artifacts", { key: null });
    const body = await all.json();
    assert.equal(body.count, 1);
  });

  test("unknown artifact returns 404", async () => {
    assert.equal((await call("GET", "/api/artifacts/ART-9999")).status, 404);
    assert.equal((await call("GET", "/api/artifacts/not-an-id")).status, 404);
  });
});

describe("Test Case 3 - update artifact", () => {
  test("PUT changes status and keeps other fields", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    const res = await call("PUT", "/api/artifacts/ART-1001", { body: { status: "Under Restoration" } });
    assert.equal(res.status, 200);
    const { artifact } = await res.json();
    assert.equal(artifact.status, "Under Restoration");
    assert.equal(artifact.name, "Bronze Nataraja");
    assert.equal(artifact.id, "ART-1001");
  });

  test("PUT cannot overwrite id or createdAt", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    const res = await call("PUT", "/api/artifacts/ART-1001", {
      body: { id: "ART-1", createdAt: "1900-01-01", name: "Renamed" },
    });
    const { artifact } = await res.json();
    assert.equal(artifact.id, "ART-1001");
    assert.notEqual(artifact.createdAt, "1900-01-01");
  });

  test("PUT with no updatable fields is rejected", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    assert.equal((await call("PUT", "/api/artifacts/ART-1001", { body: {} })).status, 400);
  });
});

describe("Test Case 4 - delete artifact", () => {
  test("DELETE removes the record", async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    const res = await call("DELETE", "/api/artifacts/ART-1001");
    assert.equal(res.status, 200);
    assert.equal((await res.json()).message, "Artifact removed successfully");
    assert.equal((await call("GET", "/api/artifacts/ART-1001")).status, 404);
    assert.equal((await call("DELETE", "/api/artifacts/ART-1001")).status, 404);
  });
});

describe("curator access", () => {
  test("writes without a key or with a wrong key return 401", async () => {
    assert.equal((await call("POST", "/api/artifacts", { body: nataraja, key: null })).status, 401);
    assert.equal((await call("POST", "/api/artifacts", { body: nataraja, key: "wrong" })).status, 401);
  });

  test("/api/auth checks the key", async () => {
    assert.equal((await call("GET", "/api/auth")).status, 200);
    assert.equal((await call("GET", "/api/auth", { key: "nope" })).status, 401);
  });

  test("returns 503 when no key is configured", async () => {
    delete env.CURATOR_API_KEY;
    assert.equal((await call("DELETE", "/api/artifacts/ART-1001")).status, 503);
  });
});

describe("search, filter, sort and statistics", () => {
  beforeEach(async () => {
    await call("POST", "/api/artifacts", { body: nataraja });
    await call("POST", "/api/artifacts", {
      body: { name: "Court Miniature", category: "Painting", era: "Mughal", status: "Under Restoration", acquisitionYear: 1975 },
    });
    await call("POST", "/api/artifacts", {
      body: { name: "Gupta Gold Dinar", category: "Coin", era: "Gupta Empire", status: "On Display", acquisitionYear: 1950 },
    });
  });

  const names = async (query) =>
    (await (await call("GET", `/api/artifacts${query}`)).json()).artifacts.map((a) => a.name);

  test("search matches across fields, case-insensitively", async () => {
    assert.deepEqual(await names("?search=mughal"), ["Court Miniature"]);
    assert.deepEqual(await names("?search=thanjavur"), ["Bronze Nataraja"]);
  });

  test("filters by category and status", async () => {
    assert.deepEqual(await names("?category=Coin"), ["Gupta Gold Dinar"]);
    assert.equal((await names("?status=On%20Display")).length, 2);
  });

  test("sorts by name, year and id", async () => {
    assert.deepEqual(await names("?sort=name"), ["Bronze Nataraja", "Court Miniature", "Gupta Gold Dinar"]);
    assert.deepEqual(await names("?sort=year"), ["Gupta Gold Dinar", "Bronze Nataraja", "Court Miniature"]);
    assert.deepEqual(await names("?sort=id"), ["Bronze Nataraja", "Court Miniature", "Gupta Gold Dinar"]);
    assert.equal((await call("GET", "/api/artifacts?sort=bogus")).status, 400);
  });

  test("stats count by status and category", async () => {
    const stats = await (await call("GET", "/api/stats")).json();
    assert.equal(stats.total, 3);
    assert.equal(stats.byStatus["On Display"], 2);
    assert.equal(stats.byCategory.Coin, 1);
    assert.equal(stats.byCategory.Textile, 0);
  });

  test("listing follows KV pagination cursors", async () => {
    const realList = env.ARTIFACTS_KV.list.bind(env.ARTIFACTS_KV);
    env.ARTIFACTS_KV.list = (opts) => realList({ ...opts, limit: 1 });
    assert.equal((await names("")).length, 3);
  });
});

describe("configuration and static files", () => {
  test("/api/config exposes the Terraform-provided APP_CONFIG binding", async () => {
    const config = await (await call("GET", "/api/config")).json();
    assert.equal(config.museumName, "Test Heritage Museum");
    assert.equal(config.environment, "test");
    assert.equal(config.version, "9.9.9");
  });

  test("/api/health reports ok", async () => {
    const health = await (await call("GET", "/api/health")).json();
    assert.equal(health.status, "ok");
  });

  test("serves index.html from SITE_ASSETS with the right content type", async () => {
    const res = await call("GET", "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("Content-Type"), /text\/html/);
    assert.equal(await res.text(), "<h1>Museum</h1>");
    assert.match((await call("GET", "/style.css")).headers.get("Content-Type"), /text\/css/);
  });

  test("missing static file and unknown routes return 404, bad methods 405", async () => {
    assert.equal((await call("GET", "/script.js")).status, 404);
    assert.equal((await call("GET", "/admin")).status, 404);
    assert.equal((await call("GET", "/api/unknown")).status, 404);
    assert.equal((await call("PATCH", "/api/artifacts")).status, 405);
  });
});
