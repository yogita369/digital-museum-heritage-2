# Digital Museum and Heritage Information System

**Automated Deployment of a Serverless Digital Museum and Heritage Information System Using Terraform-Based Infrastructure as Code**

A museum's heritage collection (sculptures, paintings, manuscripts, coins, textiles and more) catalogued in a web application that runs on **Cloudflare Workers** and stores its records in **Workers KV**. Every piece of cloud infrastructure is created, changed, destroyed and recreated by **Terraform**. Nothing is clicked together in the Cloudflare dashboard. **GitHub Actions** redeploys the application on every push.

| Component | Technology |
|---|---|
| Infrastructure as Code | Terraform (Cloudflare provider v5), reusable modules |
| Remote state | HCP Terraform (free tier, state storage and locking only) |
| Compute | Cloudflare Workers (serverless) |
| Data storage | Cloudflare Workers KV (two namespaces: records and website files) |
| Application | HTML, CSS, JavaScript; REST API in the Worker |
| Version control / CI/CD | Git, GitHub, GitHub Actions |

## Getting started

**With an AI coding agent (Claude Code, Cursor, GitHub Copilot, Codex, ...):** open this folder and say *"Help me set up and deploy this project."* The agent follows [AGENTS.md](AGENTS.md) and walks you through everything: installing tools, creating your accounts, deploying, Git history, GitHub Actions, screenshots and viva practice. You only type your credentials into the git-ignored `.env` file, never into the chat.

**By hand:** follow sections 4–6 below. Run `npm run doctor` at any point to see what is missing.

---

## 1. Architecture

**Runtime: what a visitor's request touches**

```
                 Visitor / Curator
                        |
                   Web Browser
                        |  HTTPS
                        v
     Cloudflare Worker  digital-museum-<env>.<subdomain>.workers.dev
          /                                   \
   Web interface                           REST API  /api/...
   (GET /, /style.css, /script.js)         (artifacts CRUD, search, stats)
          |                                     |
          v                                     v
   KV: museum-site-<env>                 KV: museum-artifacts-<env>
   index.html, style.css, script.js      artifact:ART-1001, artifact:ART-1002, ...
```

**Provisioning: who creates the infrastructure**

```
   Developer --git push--> GitHub repository --> GitHub Actions
                                                     |
                                                 Terraform  <---- state ---->  HCP Terraform
                                                     |
                                           Cloudflare provider
                       +-----------------------------+-----------------------------+
                       v                             v                             v
              KV namespace                   KV namespace               Worker script + bindings
           museum-artifacts-<env>          museum-site-<env>            + workers.dev route
                                        (+ 3 website files)
```

### What Terraform manages (per environment, 7 resources)

| # | Resource | Created by | Purpose |
|---|---|---|---|
| 1 | `cloudflare_workers_kv_namespace` museum-artifacts-*env* | `modules/kv` | Stores artifact records |
| 2 | `cloudflare_workers_kv_namespace` museum-site-*env* | `modules/kv` | Stores the website files |
| 3-5 | `cloudflare_workers_kv` index.html, style.css, script.js | `modules/worker` (`for_each`) | Uploads the frontend |
| 6 | `cloudflare_workers_script` digital-museum-*env* | `modules/worker` | The application, with its bindings |
| 7 | `cloudflare_workers_script_subdomain` | `modules/worker` | Publishes it on workers.dev |

**Worker bindings** are the Worker↔KV connection plus configuration:

| Binding | Type | Comes from |
|---|---|---|
| `ARTIFACTS_KV` | KV namespace | `module.artifacts_kv.id` |
| `SITE_ASSETS` | KV namespace | `module.site_kv.id` |
| `APP_CONFIG` | JSON `{environment, museumName, version}` | variables `environment`, `museum_name`, `app_version` |
| `CURATOR_API_KEY` | Secret | sensitive variable `curator_api_key` (GitHub Secret / env var) |

---

## 2. Repository layout

```
digital-museum-heritage-iac/
├── terraform/
│   ├── modules/
│   │   ├── kv/                  # reusable: one KV namespace
│   │   └── worker/              # reusable: Worker + bindings + site files + workers.dev
│   └── environments/
│       ├── dev/                 # providers.tf main.tf variables.tf outputs.tf terraform.tfvars.example
│       └── prod/                # same code, different workspace and defaults
├── application/
│   ├── worker.js                # Worker: serves the UI + REST API on KV
│   ├── index.html  style.css  script.js
├── tests/worker.test.mjs        # 23 unit tests (KV mocked, no credentials needed)
├── scripts/
│   ├── doctor.mjs               # setup check: tools, .env, Cloudflare/HCP access, next steps
│   ├── load-env.sh / .ps1       # load .env into your terminal before terraform commands
│   ├── local-preview.mjs        # run the app locally with in-memory KV
│   ├── seed-sample-data.mjs     # load 9 sample artifacts into a deployed environment
│   ├── sample-artifacts.json
│   ├── env.mjs  memory-kv.mjs   # shared helpers
├── .github/workflows/deploy.yml # CI/CD pipeline
├── docs/
│   ├── project-specification.md # the assignment brief for this project
│   ├── demo-script.md           # the 20-step viva demonstration, command by command
│   └── report.md                # mini project report draft (10 chapters)
├── screenshots/                 # evidence for submission (see checklist below)
├── AGENTS.md  CLAUDE.md          # instructions for AI coding agents
├── .env.example                 # template for your credentials (.env is git-ignored)
├── .gitignore
└── README.md
```

---

## 3. Application features

| Requirement | Implementation |
|---|---|
| FR1 Add artifact | `POST /api/artifacts`, "+ Add artifact" form (curator) |
| FR2 View artifacts | `GET /api/artifacts`, `GET /api/artifacts/{id}`, gallery and table views, detail dialog |
| FR3 Update artifact | `PUT /api/artifacts/{id}`, quick status dropdown on each card, Edit form |
| FR4 Delete artifact | `DELETE /api/artifacts/{id}` (with confirmation) |
| FR5 Persistent storage | Workers KV namespace `museum-artifacts-<env>` |
| Extra: search / filter / sort | `?search=&category=&status=&condition=&era=&sort=created\|name\|year\|id` |
| Extra: statistics | `GET /api/stats`: totals by status, category, condition |
| Extra: curator login | Writes need header `X-Curator-Key`; visitors can browse only |
| Extra: multiple environments | `terraform/environments/dev` and `prod` |
| Extra: Terraform modules | `terraform/modules/kv`, `terraform/modules/worker` |

**Artifact record** (stored in KV under key `artifact:ART-1001`):

```json
{
  "id": "ART-1001",
  "name": "Bronze Nataraja",
  "category": "Sculpture",
  "era": "Chola Dynasty, 11th century CE",
  "origin": "Thanjavur, Tamil Nadu",
  "gallery": "Gallery A - Bronzes",
  "condition": "Excellent",
  "status": "On Display",
  "acquisitionYear": 1958,
  "description": "Lost-wax bronze of Shiva as the cosmic dancer...",
  "imageUrl": "",
  "createdAt": "2026-10-14T10:48:41.566Z",
  "updatedAt": "2026-10-14T10:48:41.566Z"
}
```

Allowed values. Category: Sculpture, Painting, Manuscript, Coin, Textile, Pottery, Weapon, Jewellery, Inscription. Status: On Display, In Storage, Under Restoration, On Loan. Condition: Excellent, Good, Fair, Needs Restoration.

### REST API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/artifacts` | - | List all (with optional search/filter/sort) |
| POST | `/api/artifacts` | curator | Create; returns `201` and the new ID |
| GET | `/api/artifacts/{id}` | - | One artifact, e.g. `/api/artifacts/ART-1001` |
| PUT | `/api/artifacts/{id}` | curator | Partial update, e.g. `{"status":"Under Restoration"}` |
| DELETE | `/api/artifacts/{id}` | curator | Remove |
| GET | `/api/stats` | - | Collection statistics |
| GET | `/api/config` | - | Museum name, environment, version (from `APP_CONFIG`) |
| GET | `/api/auth` | curator | Check a curator key |
| GET | `/api/health` | - | Health check used by the pipeline |

Errors return JSON `{ "error": "...", "details": [...] }` with status 400 (validation), 401 (missing/wrong curator key), 404 or 405.

```bash
URL=https://digital-museum-dev.<subdomain>.workers.dev
KEY=<your curator key>

curl -X POST "$URL/api/artifacts" -H "X-Curator-Key: $KEY" -H "Content-Type: application/json" \
     -d '{"name":"Bronze Nataraja","category":"Sculpture","era":"Chola Dynasty, 11th century CE","status":"On Display"}'
curl "$URL/api/artifacts"
curl "$URL/api/artifacts/ART-1001"
curl -X PUT "$URL/api/artifacts/ART-1001" -H "X-Curator-Key: $KEY" -H "Content-Type: application/json" \
     -d '{"status":"Under Restoration"}'
curl -X DELETE "$URL/api/artifacts/ART-1001" -H "X-Curator-Key: $KEY"
```

---

## 4. One-time setup (about 15 minutes, all free)

### 4.1 Tools

| OS | Install |
|---|---|
| Windows | `winget install Git.Git OpenJS.NodeJS.LTS Hashicorp.Terraform` (then open a new terminal) |
| macOS | `brew install git node hashicorp/tap/terraform` |
| Linux | Git and Node from your package manager; Terraform from <https://developer.hashicorp.com/terraform/install> |

Check: `terraform --version`, `git --version`, `node --version` (20 or newer).

### 4.2 Accounts and credentials

```bash
npm run doctor -- --init-env     # creates .env (git-ignored) and generates CURATOR_API_KEY
```

Open `.env` in your editor and fill it in as you go:

| # | Do this | Direct link | Goes into `.env` |
|---|---|---|---|
| 1 | Sign up for Cloudflare (free plan) | <https://dash.cloudflare.com/sign-up> | – |
| 2 | Open Workers & Pages, pick a **workers.dev subdomain** when asked, and copy the **Account ID** shown on the right | <https://dash.cloudflare.com/?to=/:account/workers-and-pages> | `WORKERS_SUBDOMAIN` (name only), `CLOUDFLARE_ACCOUNT_ID` |
| 3 | **Create Token → Create Custom Token** with two permissions: *Account · Workers Scripts · Edit* and *Account · Workers KV Storage · Edit* | <https://dash.cloudflare.com/profile/api-tokens> | `CLOUDFLARE_API_TOKEN` |
| 4 | Sign up for HCP Terraform (free) | <https://app.terraform.io/public/signup/account> | – |
| 5 | Create an organization (any name) | <https://app.terraform.io/app/organizations/new> | `TF_CLOUD_ORGANIZATION` |
| 6 | Organization **Settings → General → Default Execution Mode → Local → Update organization** | <https://app.terraform.io/app/organizations> | – |
| 7 | Create an API token | <https://app.terraform.io/app/settings/tokens> | `TF_API_TOKEN` |
| 8 | Sign up for GitHub (if you don't have an account) | <https://github.com/signup> | – |

Then check everything (the doctor verifies the token, account, subdomain and HCP organization online, without printing any values):

```bash
npm run doctor
```

Why HCP Terraform? Your laptop and GitHub Actions both run Terraform, so they must share **one** state file, or CI would try to create resources that already exist. With *Local* execution mode, HCP only stores and locks the state, and Terraform itself runs on your machine or the CI runner.

> Do **not** create the Worker or KV namespaces in the Cloudflare dashboard. Terraform creates them; use the dashboard only to look.

### 4.3 Loading `.env` before Terraform commands

Do this once per terminal window, from the project root:

| Shell | Command |
|---|---|
| bash / zsh / macOS / Git Bash / WSL | `source scripts/load-env.sh` |
| PowerShell | `. .\scripts\load-env.ps1` (if blocked: `Set-ExecutionPolicy -Scope Process Bypass`) |

It sets `CLOUDFLARE_API_TOKEN`, `TF_CLOUD_ORGANIZATION`, `TF_TOKEN_app_terraform_io` (the HCP login, so `terraform login` isn't needed) and `TF_VAR_account_id`, `TF_VAR_workers_subdomain`, `TF_VAR_curator_api_key`.

## 5. Infrastructure lifecycle (dev)

```bash
source scripts/load-env.sh          # PowerShell: . .\scripts\load-env.ps1
cd terraform/environments/dev

terraform init        # downloads the Cloudflare provider, loads modules, connects to HCP state
terraform fmt -recursive ../..   # formats all .tf files to the standard style
terraform validate    # "Success! The configuration is valid."
terraform plan        # "Plan: 7 to add, 0 to change, 0 to destroy."
terraform apply       # type "yes" -> "Apply complete! Resources: 7 added"
terraform output      # application_url, worker_name, KV namespace IDs
terraform show        # everything Terraform recorded in state
terraform state list  # one line per managed resource
```

Load the sample collection (optional):

```bash
node ../../../scripts/seed-sample-data.mjs     # reads the URL from terraform output and the key from .env
```

**Modify** (see `docs/demo-script.md` for what to say):

```bash
# In terraform/environments/dev/variables.tf change the defaults:
#   museum_name -> "National Heritage Museum - Cloud Edition"
#   app_version -> "1.1.0"
terraform plan    # "Plan: 0 to add, 1 to change, 0 to destroy."  (~ update in-place on the Worker)
terraform apply   # refresh the app: new name and v1.1.0 in the header
```

Change the value in code (and commit it), not just with `-var` on the command line. Otherwise the next pipeline run applies the committed value again and undoes your change.

**Destroy and recreate**:

```bash
terraform plan -destroy   # "Plan: 0 to add, 0 to change, 7 to destroy."
terraform destroy         # "Destroy complete! Resources: 7 destroyed."
terraform plan            # 7 to add again: the code still describes everything
terraform apply           # environment recreated (new KV namespace IDs, empty collection)
```

Production is the same code: `cd terraform/environments/prod` and run the same commands. Prod has its own state (`museum-prod`), Worker (`digital-museum-prod`) and KV namespaces, so dev experiments never touch prod.

---

## 6. CI/CD with GitHub Actions

`.github/workflows/deploy.yml`:

```
pull request  ->  test  ->  plan (dev)  +  plan (prod)        no changes made; plan shown in job summary
push to main  ->  test  ->  deploy dev: init -> validate -> plan -> apply -> smoke test
manual run    ->  test  ->  deploy dev or prod (prod waits for approval)
```

The **test** job runs the 23 Worker unit tests, syntax-checks the JavaScript and runs `terraform fmt -check`.

**Setup:**
1. Create an **empty public** repository: <https://github.com/new> (no README, no .gitignore).
2. Open `https://github.com/<you>/<repo>/settings/secrets/actions` and copy each value from your `.env`:

| Kind | Name | Value |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Secret | `TF_API_TOKEN` | HCP Terraform API token |
| Secret | `CURATOR_API_KEY` | Same curator key you use locally |
| Variable | `TF_CLOUD_ORGANIZATION` | HCP organization name |
| Variable | `WORKERS_SUBDOMAIN` | workers.dev subdomain |

3. Connect and push:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
   The *Deploy Digital Museum* run starts automatically in the **Actions** tab.

Optional: under **Settings → Environments**, create `production` with yourself as *Required reviewer*. A prod deployment then pauses until someone approves it, which is a common real-world safeguard.

**Trigger an automatic deployment:**

```bash
# edit application/index.html: change the <h1> to
#   "Cloud-Based Digital Museum and Heritage Information System"
git add application/index.html
git commit -m "Update application title"
git push
# GitHub -> Actions: test ✔ -> Deploy (dev) ✔ ; the plan shows
#   ~ module.museum_app.cloudflare_workers_kv.site_files["index.html"] will be updated in-place
```

KV is eventually consistent. A changed file can take up to about 60 seconds to appear everywhere, so refresh again if the old title still shows.

---

## 7. Local development (no cloud needed)

```bash
npm test                 # 23 unit tests against an in-memory KV
npm run preview          # http://localhost:8787  (curator key: local-curator-key)
```

The preview runs the real `application/worker.js` with in-memory KV. It is only for development and is not part of the deployed infrastructure.

---

## 8. Security

- **No secrets in code.** Locally, all credentials live in the git-ignored `.env`; in CI they come from GitHub Secrets. The helper scripts never print them.
- **Least privilege.** The API token can only edit Workers scripts and KV in one account.
- **The curator key** is a `secret_text` binding. Cloudflare stores it encrypted, and Terraform marks it `sensitive` so it never appears in plan output.
- **State is remote**, encrypted at rest in HCP Terraform. `*.tfstate`, `tfplan` and `terraform.tfvars` are git-ignored because they can contain secret values.
- **Input validation.** All API input is validated server-side, the UI HTML-escapes every value it renders, and image URLs must be `http(s)`.

---

## 9. Screenshot checklist (deliverable F)

Save these into `screenshots/`:

| # | File | What it shows |
|---|---|---|
| 1 | `01-terraform-version.png` | `terraform --version` |
| 2 | `02-terraform-init.png` | "Terraform has been successfully initialized!" |
| 3 | `03-terraform-validate.png` | "Success! The configuration is valid." |
| 4 | `04-terraform-plan.png` | Plan with the 7 `+ create` resources highlighted |
| 5 | `05-terraform-apply.png` | "Apply complete! Resources: 7 added" and outputs |
| 6 | `06-cloudflare-worker.png` | Dashboard: Worker `digital-museum-dev`, Settings → Bindings |
| 7 | `07-cloudflare-kv.png` | Dashboard: KV namespaces `museum-artifacts-dev`, `museum-site-dev` |
| 8 | `08-web-application.png` | Application home page |
| 9 | `09-create.png` | "Artifact ART-10xx successfully created" |
| 10 | `10-update.png` | Status changed to "Under Restoration" |
| 11 | `11-delete.png` | "Artifact ART-10xx removed successfully" |
| 12 | `12-terraform-modify-plan.png` | `~ update in-place` after changing `museum_name` |
| 13 | `13-github-repository.png` | Repository with commit history |
| 14 | `14-github-actions.png` | Successful pipeline run |
| 15 | `15-terraform-destroy.png` | "Destroy complete! Resources: 7 destroyed." |
| 16 | `16-recreate.png` | `terraform apply` after destroy, with new namespace IDs |

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: No valid credential sources found` / 401 from Cloudflare | `CLOUDFLARE_API_TOKEN` not exported, or token lacks Workers Scripts / KV Edit |
| `organization ... not found` / `TF_CLOUD_ORGANIZATION` | Check the org name in `.env` (case-sensitive), reload `.env`, run `npm run doctor` |
| Plan in HCP says "remote execution" / cannot read `application/` | Set Execution Mode to **Local** (§4.2 step 6, and Workspace → Settings → General) |
| `workers.dev subdomain not found` on apply | Open Workers & Pages in the dashboard once to register your subdomain |
| App URL returns 404 for a few seconds after apply | New workers.dev routes take a moment; retry |
| Old page, or an edited/deleted artifact briefly shows its old value | Workers KV is eventually consistent: other Cloudflare data centres can serve a cached copy for up to ~60 s. On networks that route through several data centres (some corporate/VPN networks) this is more visible; on a normal home or college connection changes appear at once. Refresh after a few seconds |
| `account_id must be the 32-character...` | Use the Account ID, not the Zone ID or email |
