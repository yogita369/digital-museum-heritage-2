// Checks that everything needed to deploy this project is in place, and says
// what to do next. Secret values are never printed.
//
//   npm run doctor -- --init-env   # create .env from .env.example with a generated curator key
//   npm run doctor                 # check tools, .env, accounts (online) and repository
//   npm run doctor -- --offline    # skip the Cloudflare / HCP Terraform API checks

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { ROOT, ENV_FILE, ENV_EXAMPLE, SETTINGS, loadSettings, missingSettings } from "./env.mjs";

const args = process.argv.slice(2);
const results = { ok: 0, warn: 0, fail: 0 };
const nextSteps = [];

const ok = (msg) => (results.ok++, console.log(`  ✔ ${msg}`));
const warn = (msg, next) => (results.warn++, console.log(`  ! ${msg}`), next && nextSteps.push(next));
const fail = (msg, next) => (results.fail++, console.log(`  ✖ ${msg}`), next && nextSteps.push(next));
const section = (title) => console.log(`\n${title}`);

function run(cmd, cmdArgs, options = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", cwd: ROOT, ...options });
  return { ok: !r.error && r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), missing: r.error?.code === "ENOENT" };
}

// ------------------------------------------------------------- --init-env

if (args.includes("--init-env")) {
  if (existsSync(ENV_FILE)) {
    console.log(".env already exists - left unchanged.");
  } else {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log("Created .env from .env.example.");
  }
  const text = readFileSync(ENV_FILE, "utf8");
  if (/^CURATOR_API_KEY=\s*$/m.test(text)) {
    const key = randomBytes(18).toString("base64url");
    writeFileSync(ENV_FILE, text.replace(/^CURATOR_API_KEY=\s*$/m, `CURATOR_API_KEY=${key}`));
    console.log("Generated a random CURATOR_API_KEY in .env (open .env to see it; you type it into the app's Curator login).");
  }
  console.log("Now open .env in your editor, fill in the empty values, save, and run: npm run doctor");
  process.exit(0);
}

console.log("Digital Museum - setup check");

// ------------------------------------------------------------- tools

section("Tools");
const nodeMajor = Number(process.versions.node.split(".")[0]);
nodeMajor >= 20 ? ok(`Node.js ${process.versions.node}`) : fail(`Node.js ${process.versions.node} is too old (need 20+)`, "Install Node.js 20 or newer");

const git = run("git", ["--version"]);
git.ok ? ok(git.out) : fail("git not found", "Install Git: https://git-scm.com/downloads");

const tf = run("terraform", ["version"]);
if (tf.ok) {
  const version = tf.out.match(/Terraform v(\d+)\.(\d+)\.(\d+)/);
  if (version && (Number(version[1]) > 1 || Number(version[2]) >= 6)) ok(`Terraform ${version[0].slice(10)}`);
  else fail(`Terraform version too old: ${tf.out.split("\n")[0]}`, "Install Terraform 1.6 or newer");
} else {
  fail("terraform not found", "Install Terraform: https://developer.hashicorp.com/terraform/install");
}


// ------------------------------------------------------------- .env

section("Settings (.env)");
let settings = null;
if (!existsSync(ENV_FILE)) {
  fail(".env does not exist", "Run: node scripts/doctor.mjs --init-env   then fill in .env");
} else {
  settings = loadSettings();
  for (const [key, description] of Object.entries(SETTINGS)) {
    if (!settings[key]) fail(`${key} is empty - ${description}`);
    else ok(`${key} is set`);
  }
  const missing = missingSettings(settings);
  if (missing.length) nextSteps.push(`Fill in .env: ${missing.join(", ")}`);

  if (settings.CLOUDFLARE_ACCOUNT_ID && !/^[0-9a-f]{32}$/.test(settings.CLOUDFLARE_ACCOUNT_ID)) {
    fail("CLOUDFLARE_ACCOUNT_ID must be 32 lowercase hexadecimal characters (not the Zone ID or an email)", "Fix CLOUDFLARE_ACCOUNT_ID in .env");
  }
  if (settings.WORKERS_SUBDOMAIN && /[./:]/.test(settings.WORKERS_SUBDOMAIN)) {
    fail('WORKERS_SUBDOMAIN must be only the name, e.g. "asha-museum", not "asha-museum.workers.dev"', "Fix WORKERS_SUBDOMAIN in .env");
  }
  if (settings.CURATOR_API_KEY && settings.CURATOR_API_KEY.length < 12) {
    fail("CURATOR_API_KEY must be at least 12 characters", "Make CURATOR_API_KEY longer in .env");
  }
}

// ------------------------------------------------------------- online checks

async function api(url, token) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: {}, error: err.message };
  }
}

if (settings && !args.includes("--offline")) {
  section("Accounts (online)");
  const cfToken = settings.CLOUDFLARE_API_TOKEN;
  const accountId = settings.CLOUDFLARE_ACCOUNT_ID;

  if (cfToken) {
    let verify = await api("https://api.cloudflare.com/client/v4/user/tokens/verify", cfToken);
    if (!verify.body.success && accountId) {
      verify = await api(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`, cfToken);
    }
    if (verify.error) warn(`Could not reach Cloudflare: ${verify.error}`);
    else if (verify.body.success && verify.body.result?.status === "active") ok("Cloudflare API token is valid and active");
    else fail("Cloudflare API token was rejected", "Create a new Cloudflare API token and put it in CLOUDFLARE_API_TOKEN");

    if (accountId && verify.body.success) {
      const sub = await api(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, cfToken);
      if (sub.body.success && sub.body.result?.subdomain) {
        const actual = sub.body.result.subdomain;
        if (!settings.WORKERS_SUBDOMAIN) warn(`Your workers.dev subdomain is "${actual}"`, `Set WORKERS_SUBDOMAIN=${actual} in .env`);
        else if (actual === settings.WORKERS_SUBDOMAIN) ok(`workers.dev subdomain "${actual}" matches .env`);
        else fail(`WORKERS_SUBDOMAIN in .env does not match your account's subdomain "${actual}"`, `Set WORKERS_SUBDOMAIN=${actual} in .env`);
      } else if (sub.status === 403) {
        fail("Token cannot read Workers for this account", "Give the token Account / Workers Scripts / Edit for this account, and check CLOUDFLARE_ACCOUNT_ID");
      } else {
        fail("No workers.dev subdomain found for this account", "Open Cloudflare dashboard -> Workers & Pages once and choose a workers.dev subdomain");
      }

      const kv = await api(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces?per_page=5`, cfToken);
      if (kv.body.success) ok("Token can access Workers KV");
      else fail("Token cannot access Workers KV", "Add the permission Account / Workers KV Storage / Edit to the Cloudflare token");
    }
  }

  const org = settings.TF_CLOUD_ORGANIZATION;
  if (org && settings.TF_API_TOKEN) {
    const orgRes = await api(`https://app.terraform.io/api/v2/organizations/${encodeURIComponent(org)}`, settings.TF_API_TOKEN);
    if (orgRes.error) warn(`Could not reach HCP Terraform: ${orgRes.error}`);
    else if (orgRes.status === 200) {
      ok(`HCP Terraform organization "${org}" is accessible`);
      const defaultMode = orgRes.body.data?.attributes?.["default-execution-mode"];
      if (defaultMode === "local") ok("Organization default execution mode is Local");
      else if (defaultMode) fail(`Organization default execution mode is "${defaultMode}" (must be "local")`, "HCP Terraform -> Organization Settings -> General -> Default Execution Mode: Local -> Update");
      for (const name of ["museum-dev", "museum-prod"]) {
        const ws = await api(`https://app.terraform.io/api/v2/organizations/${encodeURIComponent(org)}/workspaces/${name}`, settings.TF_API_TOKEN);
        const mode = ws.body.data?.attributes?.["execution-mode"];
        if (ws.status === 404) continue; // created by the first `terraform init`
        if (mode === "local") ok(`Workspace ${name} uses Local execution mode`);
        else if (mode) fail(`Workspace ${name} uses "${mode}" execution mode (must be "local")`, `HCP Terraform -> Workspaces -> ${name} -> Settings -> General -> Execution Mode: Local`);
      }
    } else {
      fail(`HCP Terraform rejected the token or organization "${org}" (HTTP ${orgRes.status})`, "Check TF_CLOUD_ORGANIZATION spelling and create a new TF_API_TOKEN");
    }
  }
}

// ------------------------------------------------------------- repository

section("Repository");
const top = run("git", ["rev-parse", "--show-toplevel"]);
const isOwnRepo = top.ok && top.out.replace(/\\/g, "/").replace(/\/$/, "") === ROOT.replace(/\\/g, "/").replace(/\/$/, "");
if (!isOwnRepo) {
  warn("This folder is not a git repository yet", "Initialise Git and make the first commits (see AGENTS.md, step 4)");
} else {
  const name = run("git", ["config", "user.name"]).out;
  const email = run("git", ["config", "user.email"]).out;
  name && email ? ok(`Git author: ${name} <${email}>`) : warn("Git author name/email not set", 'Run: git config user.name "Your Name" && git config user.email "you@example.com"');
  const count = run("git", ["rev-list", "--count", "HEAD"]);
  count.ok ? ok(`${count.out} commit(s)`) : warn("No commits yet");
  const remote = run("git", ["remote", "get-url", "origin"]);
  remote.ok ? ok(`GitHub remote: ${remote.out}`) : warn("No GitHub remote (origin) yet", "Create the GitHub repository (see AGENTS.md, step 7)");
  const tracked = run("git", ["ls-files", ".env", "terraform.tfvars", "*.tfstate"]);
  if (tracked.out) fail(`Secret files are tracked by git: ${tracked.out.replace(/\n/g, ", ")}`, "Remove them from git: git rm --cached <file>");
}

const initialised = ["dev", "prod"].filter((e) => existsSync(join(ROOT, "terraform", "environments", e, ".terraform", "terraform.tfstate")));
initialised.length
  ? ok(`terraform init done for: ${initialised.join(", ")}`)
  : warn("terraform init has not been run against HCP Terraform yet", "Load .env (source scripts/load-env.sh), then: cd terraform/environments/dev && terraform init");

// ------------------------------------------------------------- summary

console.log(`\n${results.ok} ok, ${results.warn} warning(s), ${results.fail} problem(s)`);
if (nextSteps.length) {
  console.log("\nNext steps:");
  [...new Set(nextSteps)].forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
} else {
  console.log("\nEverything needed for deployment is in place.");
}
process.exit(results.fail ? 1 : 0);
