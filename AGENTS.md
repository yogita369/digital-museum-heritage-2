# AGENTS.md: guide for AI coding agents working in this repository

You are helping **the student who owns this copy** deploy it to **their own** Cloudflare account and **their own** GitHub repository, collect the screenshots, and prepare for the viva. The code is complete and tested. Your job is setup and teaching, not rewriting the app.

The project is a Digital Museum and Heritage Information System: a Cloudflare Worker with Workers KV, built by Terraform, with state in HCP Terraform and deployment by GitHub Actions. For more detail see `README.md`, `docs/demo-script.md` and `docs/report.md`.

## Rules

1. **Secrets go only in `.env`** (git-ignored). Never ask the student to paste a token into the chat. Ask them to put it in `.env`, save, and say "done". Never print `.env`. Check it with `npm run doctor`, which shows only *set / valid*, never values.
2. **Never create Cloudflare resources by hand or through the API.** Terraform creates everything; that's what is graded.
3. **Ask first** before `terraform apply`, `terraform destroy`, and `git push`.
4. **The student runs the screenshot commands in their own terminal** (init, validate, plan, apply, destroy). Give them the exact command and say what they should see.
5. **Explain each step in 2–3 simple sentences** they can repeat in the viva.
6. Keep short notes in `.setup-progress.md` (git-ignored). At the start of a session, read it and run `npm run doctor`.
7. Give commands for the student's OS. On Windows, use PowerShell.

**Running Terraform:** from the project root, load `.env` and then use plain terraform:
- bash / macOS / Git Bash: `source scripts/load-env.sh`, then `cd terraform/environments/dev`
- PowerShell: `. .\scripts\load-env.ps1`, then `cd terraform\environments\dev`

---

## Step 1: Install tools

Needed: **Git**, **Node.js 20+**, **Terraform**.
- Windows: `winget install Git.Git OpenJS.NodeJS.LTS Hashicorp.Terraform` (then open a new terminal)
- macOS: `brew install git node hashicorp/tap/terraform`
- Linux: https://developer.hashicorp.com/terraform/install

Then run `npm test` (23 tests pass) and `npm run doctor`. 📸 `01-terraform-version.png` = `terraform --version`

## Step 2: Accounts and `.env` (about 10 minutes, all free)

Run `npm run doctor -- --init-env`. This creates `.env` and fills in `CURATOR_API_KEY`. Give the student these links one at a time. After each one they paste the value into `.env`.

| # | Do this | Link | Put in `.env` |
|---|---|---|---|
| 1 | Sign up for Cloudflare (free plan) | https://dash.cloudflare.com/sign-up | – |
| 2 | Open Workers & Pages, choose a **workers.dev subdomain** when asked, then copy the **Account ID** from the right-hand side | https://dash.cloudflare.com/?to=/:account/workers-and-pages | `WORKERS_SUBDOMAIN` (name only), `CLOUDFLARE_ACCOUNT_ID` |
| 3 | Create Token → *Create Custom Token*. Add two permissions: **Account · Workers Scripts · Edit** and **Account · Workers KV Storage · Edit** → Continue → Create | https://dash.cloudflare.com/profile/api-tokens | `CLOUDFLARE_API_TOKEN` |
| 4 | Sign up for HCP Terraform (free) | https://app.terraform.io/public/signup/account | – |
| 5 | Create an organization (any name) | https://app.terraform.io/app/organizations/new | `TF_CLOUD_ORGANIZATION` |
| 6 | In that organization: **Settings → General → Default Execution Mode → Local → Update organization** | https://app.terraform.io/app/organizations (pick it → Settings) | – |
| 7 | Create an API token | https://app.terraform.io/app/settings/tokens | `TF_API_TOKEN` |
| 8 | Sign up for GitHub (if needed) | https://github.com/signup | – |

Run `npm run doctor`. It checks the Cloudflare token, the account ID, the subdomain and the HCP organization online. Fix every ✖ before going on.

Explain: the token has only the two permissions it needs (least privilege). HCP Terraform keeps the shared *state* so the laptop and GitHub Actions see the same infrastructure. "Local" mode means Terraform still runs on this machine.

## Step 3: Initialise, validate, plan, apply (dev)

The student runs these in their own terminal, after loading `.env`:

```bash
cd terraform/environments/dev
terraform init        # 📸 02  "Terraform has been successfully initialized!"
terraform validate    # 📸 03  "Success! The configuration is valid."
terraform plan        # 📸 04  "Plan: 7 to add, 0 to change, 0 to destroy."
terraform apply       # type yes   📸 05  "Apply complete! Resources: 7 added" + application_url
```

Walk through the 7 resources in the plan using the table in `docs/demo-script.md` step 4. Then the student opens the Cloudflare dashboard: Worker `digital-museum-dev` → Settings → Bindings 📸 06, then Storage & Databases → KV 📸 07.

## Step 4: Git history (under the student's own name)

1. `git init -b main`, then `git config user.name "<their name>"` and `git config user.email "<their GitHub email>"`.
2. Check that `git status --ignored` shows `.env` as ignored.
3. Commit in stages so the history is meaningful:

| # | Message | Files |
|---|---|---|
| 1 | Initial Terraform configuration | `.gitignore` `.env.example` `screenshots/` `terraform/environments/dev/providers.tf` `variables.tf` `terraform.tfvars.example` `.terraform.lock.hcl` |
| 2 | Added KV namespace | `terraform/modules/kv/` |
| 3 | Added CRUD API | `application/worker.js` `tests/` `scripts/memory-kv.mjs` `package.json` |
| 4 | Added Worker and Worker-KV binding | `terraform/modules/worker/` `terraform/environments/dev/main.tf` `outputs.tf` |
| 5 | Added museum web interface | `application/index.html` `style.css` `script.js` `scripts/local-preview.mjs` `scripts/sample-artifacts.json` |
| 6 | Added multiple environments | `terraform/environments/prod/` |
| 7 | Added GitHub Actions | `.github/` |
| 8 | Added documentation | everything else |

Afterwards, `git ls-files` must not list `.env`.

## Step 5: Test the app

`node scripts/seed-sample-data.mjs` loads 9 sample artifacts (optional). The student opens `application_url` 📸 08, clicks **Curator login** and types the `CURATOR_API_KEY` from `.env`. Then they create 📸 09, update the status 📸 10 and delete 📸 11 an artifact (`docs/demo-script.md` steps 9–12).

## Step 6: Modify

In `terraform/environments/dev/variables.tf`, change the defaults of `museum_name` and `app_version` (to `"1.1.0"`). Run `terraform plan`: expect `~ update in-place` 📸 12. Then `apply`, refresh the app, and commit with the message "Rename museum and bump version to 1.1.0".

## Step 7: GitHub and CI/CD

1. Create an **empty public** repository: https://github.com/new (no README, no .gitignore).
2. Add **Secrets and variables → Actions** at `https://github.com/<user>/<repo>/settings/secrets/actions`. The student copies each value from `.env`:
   - **Secrets** tab: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TF_API_TOKEN`, `CURATOR_API_KEY`
   - **Variables** tab: `TF_CLOUD_ORGANIZATION`, `WORKERS_SUBDOMAIN`

   📸 the secrets list (names only; values are never shown)
3. `git remote add origin https://github.com/<user>/<repo>.git`, then `git push -u origin main` (ask first). GitHub opens a browser login the first time.
4. The Actions tab runs *Deploy Digital Museum*, and it should go green. 📸 13 repository, 📸 14 Actions run.
5. Auto-deploy demo: change the `<h1>` in `application/index.html` to **Cloud-Based Digital Museum and Heritage Information System**, then commit and push. The pipeline updates the site by itself.

## Step 8: Destroy and recreate (ask first; this deletes the data)

```bash
terraform plan -destroy   # 7 to destroy
terraform destroy         # yes   📸 15 "Destroy complete! Resources: 7 destroyed."
terraform apply           # yes   📸 16 everything recreated, with new KV IDs
```
Explain: the infrastructure comes back from code, but the data doesn't.

## Step 9: Viva preparation

Help fill in the `[ ]` placeholders in `docs/report.md` and add the screenshots. Rehearse `docs/demo-script.md`. Quiz the student one question at a time from the "Answers to the Prescribed Questions" and "Viva Preparation" sections of `docs/report.md`.

---

## If something fails

| Problem | Fix |
|---|---|
| Doctor: Cloudflare token rejected | Create the token again with exactly the two Edit permissions |
| Doctor: subdomain mismatch / none | Use the name the doctor shows; open Workers & Pages once if none exists |
| `terraform init`: organization not found | `TF_CLOUD_ORGANIZATION` is case-sensitive; reload `.env` after editing it |
| Plan runs "remotely" / can't read `application/` | Step 2, link 6: set Execution Mode to Local (also per workspace: Workspace → Settings → General) |
| GitHub Actions fails at `terraform init` | A secret or variable from Step 7 is missing or misspelled |
| Smoke test fails on the first run | A new workers.dev URL can take a minute; click *Re-run jobs* |
| Old page, or an edited/deleted artifact briefly shows its old value | Workers KV is eventually consistent: other Cloudflare data centres can serve a cached copy for up to ~60 s. On networks that route through several data centres (some corporate/VPN networks) this is more visible; on a normal home or college connection changes appear at once. Refresh after a few seconds |
