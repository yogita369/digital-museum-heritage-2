// Runs application/worker.js on your machine, with in-memory KV, so you can
// try the UI before deploying. This is not part of the deployed infrastructure.
//
//   node scripts/local-preview.mjs            # sample collection pre-loaded
//   node scripts/local-preview.mjs --empty    # start with no artifacts
//
// Open http://localhost:8787. Curator key: local-curator-key
// (override with CURATOR_API_KEY=... ). Data is lost when the process stops.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import worker from "../application/worker.js";
import { MemoryKV } from "./memory-kv.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 8787);
const curatorKey = process.env.CURATOR_API_KEY || "local-curator-key";

// Read site files from disk on every request so edits show up on refresh.
const siteAssets = {
  async get(key) {
    try {
      return await readFile(`${root}application/${key}`, "utf8");
    } catch {
      return null;
    }
  },
};

const env = {
  ARTIFACTS_KV: new MemoryKV(),
  SITE_ASSETS: siteAssets,
  APP_CONFIG: {
    environment: "local",
    museumName: "National Heritage Museum (local preview)",
    version: "0.0.0-local",
  },
  CURATOR_API_KEY: curatorKey,
};

if (!process.argv.includes("--empty")) {
  const samples = JSON.parse(await readFile(`${root}scripts/sample-artifacts.json`, "utf8"));
  for (const artifact of samples) {
    await worker.fetch(
      new Request("http://localhost/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Curator-Key": curatorKey },
        body: JSON.stringify(artifact),
      }),
      env,
    );
  }
}

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await worker.fetch(request, env);

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(`${req.method} ${req.url} -> ${response.status}`);
}).listen(port, () => {
  console.log(`Local preview: http://localhost:${port}  (curator key: ${curatorKey})`);
});
