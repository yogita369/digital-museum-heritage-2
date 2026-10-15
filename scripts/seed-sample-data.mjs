// Loads the sample heritage collection into a deployed environment through
// the public REST API (the same path the UI uses).
//
//   node scripts/seed-sample-data.mjs          # dev
//   node scripts/seed-sample-data.mjs prod
//
// The curator key comes from .env (CURATOR_API_KEY) and the URL from
// `terraform output application_url`. APP_URL=https://... overrides the URL.
//
// Run it after `terraform apply`, and again after destroy + recreate,
// because a recreated KV namespace starts empty.

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ROOT, loadSettings, terraformEnv, failMissing } from "./env.mjs";

const environment = process.argv[2] || "dev";
const settings = loadSettings();
if (!settings.CURATOR_API_KEY) failMissing(["CURATOR_API_KEY"]);

let appUrl = process.env.APP_URL;
if (!appUrl) {
  const out = spawnSync(
    "terraform",
    [`-chdir=${join(ROOT, "terraform", "environments", environment)}`, "output", "-raw", "application_url"],
    { encoding: "utf8", env: terraformEnv(settings) },
  );
  appUrl = out.status === 0 ? out.stdout.trim() : "";
}
appUrl = appUrl.replace(/\/+$/, "");
if (!/^https?:\/\//.test(appUrl)) {
  console.error(`Could not find the ${environment} application URL. Run \`terraform apply\` in terraform/environments/${environment} first, or set APP_URL.`);
  process.exit(1);
}

const samples = JSON.parse(await readFile(new URL("./sample-artifacts.json", import.meta.url), "utf8"));
let failures = 0;

for (const artifact of samples) {
  const res = await fetch(`${appUrl}/api/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Curator-Key": settings.CURATOR_API_KEY },
    body: JSON.stringify(artifact),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`created ${body.artifact.id}  ${artifact.name}`);
  } else {
    failures++;
    console.error(`failed  ${artifact.name}: ${res.status} ${body.error || ""}`);
  }
}

console.log(`\n${samples.length - failures}/${samples.length} artifacts loaded into ${appUrl}`);
process.exit(failures ? 1 : 0);
