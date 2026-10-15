# Automated Deployment of a Serverless Digital Museum and Heritage Information System Using Terraform-Based Infrastructure as Code

**Mini Project Report: Cloud Computing / Infrastructure as Code**

| | |
|---|---|
| Student(s) | *[Name, Roll No.]* |
| Class / Division | *[ ]* |
| Guide | *[ ]* |
| Institute | *[ ]* |
| Academic Year | *[2026–27]* |
| Repository | *[https://github.com/&lt;user&gt;/digital-museum-heritage-iac]* |
| Live application | *[https://digital-museum-dev.&lt;subdomain&gt;.workers.dev]* |

---

## Abstract

Museums hold irreplaceable cultural heritage, yet many still catalogue collections in registers or spreadsheets that the public cannot see. This project builds a **Digital Museum and Heritage Information System**: a web application in which visitors browse and search a museum's collection and curators catalogue artifacts and track their condition and exhibition status. The application is serverless. A single **Cloudflare Worker** serves the web interface and a REST API, and artifact records are kept in **Cloudflare Workers KV**.

The main focus of the project is how this infrastructure is created. No resource is created by hand. Two KV namespaces, the website files, the Worker, its bindings, its secret and its public URL are all declared in **Terraform** and organised into reusable modules. A dev and a prod environment are created from the same code. State is stored remotely in HCP Terraform, the code is versioned in **Git/GitHub**, and a **GitHub Actions** pipeline tests, plans and applies every change. The project demonstrates the full IaC lifecycle: define, initialise, validate, plan, apply, modify, destroy and recreate. The whole environment of seven resources is rebuilt from code in under a minute.

---

## Chapter 1 – Introduction

### 1.1 Background
Cultural heritage institutions are increasingly expected to make their collections accessible online. A digital catalogue lets the public explore artifacts, helps researchers find items by era or origin, and gives curators an up-to-date record of where each object is (on display, in storage, under restoration or on loan) and what condition it is in.

Building such a system on the cloud raises a second question: **how should the cloud infrastructure itself be managed?** Clicking resources together in a dashboard is quick the first time but cannot be repeated reliably, reviewed or audited. Infrastructure as Code (IaC) treats infrastructure like software. It is written in files, stored in version control, reviewed, tested and applied automatically.

### 1.2 Objectives
1. Develop a heritage information system with full CRUD functionality for museum artifacts.
2. Host it on serverless infrastructure (Cloudflare Workers and Workers KV) on the free plan.
3. Provision **all** infrastructure with Terraform: no manual dashboard configuration.
4. Use variables, outputs, modules and multiple environments to keep the code reusable.
5. Version-control the project in GitHub and deploy it automatically with GitHub Actions.
6. Demonstrate modification, drift detection, destruction and complete recreation of the infrastructure.

### 1.3 Scope
The system covers cataloguing (create, view, update, delete), search, filtering, sorting, collection statistics and a curator-only write mode. Ticketing, visitor accounts and image hosting are outside the scope and are discussed as future work.

### 1.4 Organisation of the report
Chapter 2 covers cloud computing and IaC concepts. Chapter 3 states the problem. Chapter 4 presents the architecture. Chapter 5 describes the technologies used. Chapters 6–8 explain the Terraform configuration, the application and the CI/CD pipeline. Chapter 9 reports testing and results, and Chapter 10 concludes. Answers to the prescribed questions and the viva questions follow.

---

## Chapter 2 – Background of Cloud Computing and IaC

### 2.1 Cloud computing
Cloud computing delivers computing resources (servers, storage, databases, networking, software) over the internet, on demand, with pay-per-use pricing. NIST lists five essential characteristics: *on-demand self-service, broad network access, resource pooling, rapid elasticity* and *measured service*.

| Service model | The provider manages | Example |
|---|---|---|
| IaaS | Hardware, virtualisation | Virtual machines |
| PaaS | + OS, runtime | Managed app platforms |
| **FaaS / Serverless** | + scaling, servers entirely | **Cloudflare Workers** |
| SaaS | Everything | Web email |

### 2.2 Serverless computing
In serverless (Function-as-a-Service) computing, the developer uploads code and the platform runs it on demand, scales it automatically and bills per request. There is no server to patch or size. Cloudflare Workers run on V8 *isolates*, which are lightweight sandboxes that start in milliseconds, in data centres around the world, so a request is served close to the user.

### 2.3 Key-value storage
A key-value (KV) store keeps values that are looked up by a unique key, like a distributed dictionary. Workers KV replicates data globally and caches it at the edge. It is optimised for read-heavy workloads and is *eventually consistent*: a write becomes visible everywhere within about 60 seconds. A museum catalogue is read far more often than it is changed, so this suits it well.

### 2.4 Infrastructure as Code
IaC means managing infrastructure through machine-readable definition files rather than manual processes. There are two styles:

- **Imperative**: a script lists the *steps* to perform ("create a namespace, then create a worker…").
- **Declarative**: the file describes the *desired end state*, and the tool works out the steps. Terraform is declarative.

Benefits: repeatability, consistency across environments, version history, peer review, automation, fast disaster recovery and self-documenting infrastructure.

### 2.5 Terraform
Terraform (HashiCorp) is an open-source, cloud-agnostic, declarative IaC tool. Configuration is written in HCL. Its core workflow is **write → init → plan → apply**. It talks to each platform through a *provider* plugin and records what it manages in a *state* file.

### 2.6 CI/CD and GitOps
Continuous Integration automatically builds and tests every change. Continuous Delivery/Deployment automatically releases changes that pass. When infrastructure code lives in Git and a pipeline applies it, the repository becomes the single source of truth for the environment. This practice is often called *GitOps*.

---

## Chapter 3 – Problem Statement

A museum needs an online catalogue of its heritage collection. Building the cloud infrastructure for it by hand in a dashboard has these problems:

1. **Not reproducible.** Nobody can be sure the next environment is identical.
2. **Error-prone.** A mistyped binding name or a wrong namespace breaks the app.
3. **Untracked.** There is no history of who changed what, when or why.
4. **Slow recovery.** After an accidental deletion, everything must be recreated from memory.
5. **Inconsistent environments.** Dev and production drift apart.
6. **No version control or review** for infrastructure changes.

**Problem:** design and deploy a serverless Digital Museum and Heritage Information System on Cloudflare in which the Worker, the KV storage, the bindings and all configuration are created, changed, destroyed and recreated **only through Terraform code**, kept in GitHub and deployed automatically by GitHub Actions.

---

## Chapter 4 – Proposed Architecture

### 4.1 Runtime architecture

```
                 Visitor / Researcher / Curator
                              |
                         Web Browser
                              |  HTTPS
                              v
       Cloudflare Worker  digital-museum-<env>.<subdomain>.workers.dev
             /                                        \
     Web interface                                  REST API  /api/*
  GET / , /style.css , /script.js            CRUD, search, filter, stats
             |                                         |
             v                                         v
  Workers KV  museum-site-<env>            Workers KV  museum-artifacts-<env>
  index.html, style.css, script.js        artifact:ART-1001, ..., meta:next_id
```

*[Figure 4.1: insert screenshot `08-web-application.png`]*

One Worker serves both the user interface and the API. The browser loads the HTML, CSS and JS (which the Worker reads from the *site* namespace) and then calls the REST API, which reads and writes the *artifacts* namespace.

### 4.2 Provisioning architecture

```
   Developer ──git push──▶ GitHub ──▶ GitHub Actions ──▶ Terraform ◀──state──▶ HCP Terraform
                                                            │
                                                  Cloudflare provider (API)
                        ┌───────────────────────────────────┼─────────────────────────────┐
                        ▼                                   ▼                             ▼
            KV museum-artifacts-<env>             KV museum-site-<env>        Worker digital-museum-<env>
                                                  + 3 website files            + 4 bindings + workers.dev URL
```

### 4.3 Environments
`terraform/environments/dev` and `terraform/environments/prod` call the same modules with different variables and separate state workspaces (`museum-dev`, `museum-prod`). Every resource name carries an environment suffix, so the two environments never collide.

### 4.4 Data model

| Field | Type | Rules |
|---|---|---|
| id | string | Generated, `ART-1001`, `ART-1002`, … |
| name | string | Required, 2–120 characters |
| category | enum | Sculpture, Painting, Manuscript, Coin, Textile, Pottery, Weapon, Jewellery, Inscription |
| era | string | Required, e.g. "Chola Dynasty, 11th century CE" |
| origin, gallery | string | Optional |
| condition | enum | Excellent, Good, Fair, Needs Restoration (default Good) |
| status | enum | On Display, In Storage, Under Restoration, On Loan (default In Storage) |
| acquisitionYear | integer | Optional, 1500 to the current year |
| description | string | Optional, up to 2000 characters |
| imageUrl | URL | Optional, http(s) only |
| createdAt, updatedAt | ISO timestamp | Set by the server |

Each record is stored as JSON under the KV key `artifact:<id>`. A counter key `meta:next_id` produces sequential IDs.

---

## Chapter 5 – Technologies Used

| Technology | Role in this project | Why it was chosen |
|---|---|---|
| **Terraform 1.16** | Declares and provisions all infrastructure | Industry-standard, declarative, official Cloudflare provider |
| **Cloudflare provider v5** | Turns Terraform resources into Cloudflare API calls | Official, supports Workers, KV and bindings |
| **HCP Terraform** (free) | Remote state storage and locking | Lets the laptop and CI share one state safely |
| **Cloudflare Workers** | Serverless compute: UI and API | Free plan (100k requests/day), no servers, global edge |
| **Workers KV** | Artifact records and website files | Free, globally replicated, read-optimised |
| **HTML / CSS / JavaScript** | Frontend | No framework or build step needed |
| **Git / GitHub** | Version control and repository | History, collaboration, review |
| **GitHub Actions** | CI/CD pipeline | Built into GitHub, free for public repositories |
| **Node.js test runner** | Unit tests for the Worker | Built into Node, no dependencies |

---

## Chapter 6 – Terraform Configuration

### 6.1 Structure

```
terraform/
├── modules/
│   ├── kv/       main.tf  variables.tf  outputs.tf  versions.tf
│   └── worker/   main.tf  variables.tf  outputs.tf  versions.tf
└── environments/
    ├── dev/      providers.tf  main.tf  variables.tf  outputs.tf  terraform.tfvars.example  .terraform.lock.hcl
    └── prod/     (same, workspace museum-prod, environment = "prod")
```

### 6.2 Provider and backend (`providers.tf`)

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }
  cloud {
    workspaces { name = "museum-dev" }
  }
}

provider "cloudflare" {}   # token from CLOUDFLARE_API_TOKEN
```

- `required_providers` tells `terraform init` which plugin to download. The version constraint `~> 5.28` allows bug-fix and feature releases within v5 but not a breaking v6. The `.terraform.lock.hcl` file pins the exact version and checksums for every machine.
- The `cloud` block stores state in HCP Terraform. The organisation name comes from `TF_CLOUD_ORGANIZATION`. Execution mode is *Local*, so HCP only stores and locks state.
- The provider block is empty because the API token is read from the environment variable `CLOUDFLARE_API_TOKEN`. **No credential appears in any file.**

### 6.3 Variables (`variables.tf`)

| Variable | Default | Notes |
|---|---|---|
| `account_id` | – (required) | Validated: 32 hex characters |
| `workers_subdomain` | – (required) | Used to build the URL output |
| `curator_api_key` | – (required) | `sensitive = true`, minimum 12 characters |
| `environment` | `dev` / `prod` | Validated: one of dev, test, prod |
| `worker_name` | `digital-museum` | Final name `digital-museum-<env>` |
| `kv_namespace_name` | `museum-artifacts` | Final name `museum-artifacts-<env>` |
| `site_kv_namespace_name` | `museum-site` | Final name `museum-site-<env>` |
| `museum_name` | `National Heritage Museum - Development` | Shown in the UI |
| `app_version` | `1.0.0` | Shown in the UI |
| `compatibility_date` | `2026-09-01` | Workers runtime version |

`validation` blocks catch mistakes such as a wrong account ID format during `plan`, before any API call is made.

### 6.4 Root module (`main.tf`)

```hcl
module "artifacts_kv" {
  source     = "../../modules/kv"
  account_id = var.account_id
  title      = "${var.kv_namespace_name}-${var.environment}"
}

module "site_kv" {
  source     = "../../modules/kv"
  account_id = var.account_id
  title      = "${var.site_kv_namespace_name}-${var.environment}"
}

module "museum_app" {
  source                    = "../../modules/worker"
  script_name               = "${var.worker_name}-${var.environment}"
  artifacts_kv_namespace_id = module.artifacts_kv.id
  site_kv_namespace_id      = module.site_kv.id
  # ... environment, museum_name, app_version, curator_api_key, ...
}
```

The references `module.artifacts_kv.id` → `module.museum_app` create an **implicit dependency**. Terraform therefore creates the namespaces first and the Worker afterwards, and destroys them in the reverse order.

### 6.5 KV module
One resource, `cloudflare_workers_kv_namespace`. It is reused twice, which shows how a module removes duplication.

### 6.6 Worker module

```hcl
resource "cloudflare_workers_kv" "site_files" {
  for_each     = toset(["index.html", "style.css", "script.js"])
  namespace_id = var.site_kv_namespace_id
  key_name     = each.value
  value        = file("${var.application_dir}/${each.value}")
}

resource "cloudflare_workers_script" "this" {
  script_name = var.script_name
  content     = file("${var.application_dir}/worker.js")
  main_module = "worker.js"
  bindings = [
    { name = "ARTIFACTS_KV",    type = "kv_namespace", namespace_id = var.artifacts_kv_namespace_id },
    { name = "SITE_ASSETS",     type = "kv_namespace", namespace_id = var.site_kv_namespace_id },
    { name = "APP_CONFIG",      type = "json",         json = jsonencode({ environment = ..., museumName = ..., version = ... }) },
    { name = "CURATOR_API_KEY", type = "secret_text",  text = var.curator_api_key },
  ]
}

resource "cloudflare_workers_script_subdomain" "this" {
  script_name = cloudflare_workers_script.this.script_name
  enabled     = true
}
```

- `for_each` creates one KV entry per website file. Because the value is `file(...)`, any edit to a frontend file appears in the next `plan` as an in-place update.
- **Bindings** connect the Worker to resources. Inside the code they appear as `env.ARTIFACTS_KV`, `env.SITE_ASSETS`, `env.APP_CONFIG` and `env.CURATOR_API_KEY`.
- `APP_CONFIG` is a JSON binding, so configuration changes are shown in readable form in the plan. The curator key is a `secret_text` binding: encrypted by Cloudflare and shown as *(sensitive value)* by Terraform.
- `cloudflare_workers_script_subdomain` publishes the Worker on `https://<script>.<subdomain>.workers.dev`.

### 6.7 Outputs (`outputs.tf`)
`environment`, `worker_name`, `artifacts_kv_namespace_id`, `site_kv_namespace_id`, `site_files`, `application_url`. These are printed after `apply` and are used by the pipeline's smoke test and the seeding script.

### 6.8 Resources managed per environment

| # | Address | Resource |
|---|---|---|
| 1 | `module.artifacts_kv.cloudflare_workers_kv_namespace.this` | KV namespace (records) |
| 2 | `module.site_kv.cloudflare_workers_kv_namespace.this` | KV namespace (website) |
| 3–5 | `module.museum_app.cloudflare_workers_kv.site_files["…"]` | 3 website files |
| 6 | `module.museum_app.cloudflare_workers_script.this` | Worker + 4 bindings |
| 7 | `module.museum_app.cloudflare_workers_script_subdomain.this` | workers.dev URL |

*[Figure 6.1: `04-terraform-plan.png`, "Plan: 7 to add"]*
*[Figure 6.2: `05-terraform-apply.png`]*
*[Figure 6.3: `06-cloudflare-worker.png`, bindings tab]*
*[Figure 6.4: `07-cloudflare-kv.png`]*

---

## Chapter 7 – Application Implementation

### 7.1 Worker (`application/worker.js`)
An ES-module Worker exporting `fetch(request, env)`. It routes requests:

| Path | Behaviour |
|---|---|
| `/`, `/style.css`, `/script.js` | Read from `env.SITE_ASSETS`, return with the correct Content-Type |
| `GET /api/artifacts` | `ARTIFACTS_KV.list({prefix: "artifact:"})` → `get` each → filter, search, sort |
| `POST /api/artifacts` | Validate → next ID from `meta:next_id` → `ARTIFACTS_KV.put` → 201 |
| `GET /api/artifacts/{id}` | `ARTIFACTS_KV.get(key, "json")` or 404 |
| `PUT /api/artifacts/{id}` | Validate a partial update → merge → `put`. `id` and `createdAt` are protected |
| `DELETE /api/artifacts/{id}` | `ARTIFACTS_KV.delete` or 404 |
| `GET /api/stats` | Counts by status, category, condition |
| `GET /api/config`, `/api/health` | Values from `APP_CONFIG`; health check |

**Validation.** Required fields, lengths, allowed category/status/condition values, year range and the http(s)-only image URL are checked on the server. On failure the API returns `400` with a list of messages.

**Curator access.** Create, update and delete require the header `X-Curator-Key` to match the `CURATOR_API_KEY` secret (compared in constant time). Otherwise the API returns `401`. Visitors can only read.

**Pagination.** KV `list` returns at most 1000 keys per call, so the Worker follows the `cursor` until `list_complete`.

**Design note.** KV has no atomic increment, so two curators creating artifacts at exactly the same moment could, in rare cases, receive the same ID. That is acceptable for a single museum's catalogue. Chapter 10 discusses Durable Objects or D1 as the fix.

### 7.2 Frontend (`index.html`, `style.css`, `script.js`)
- Header with the museum name, an environment badge (DEV/PROD) and the version, all from `/api/config`, so Terraform variables are visible in the UI.
- Statistics tiles (total, on display, in storage, under restoration, on loan) and a by-category bar chart.
- A toolbar with search (debounced), category and status filters, sorting, and a gallery/table view toggle.
- Artifact cards with a quick status dropdown, Edit and Delete (curator only); a detail dialog; an add/edit form dialog with server validation messages.
- Curator login dialog. The key is checked with `/api/auth` and kept in `sessionStorage` for the browser tab.
- Every value is HTML-escaped before rendering (XSS protection). The layout is responsive down to phone width.

*[Figures 7.1–7.4: home page, add form, table view, mobile view]*

### 7.3 Local development tooling
- `scripts/local-preview.mjs` runs the real Worker with in-memory KV at `localhost:8787`.
- `scripts/seed-sample-data.mjs` loads nine sample Indian heritage artifacts through the public API.
- `tests/worker.test.mjs` contains 23 unit tests (Chapter 9).

---

## Chapter 8 – CI/CD Implementation

### 8.1 Pipeline (`.github/workflows/deploy.yml`)

```
                    ┌──────────────────────── test ────────────────────────┐
 pull request ──▶   │ checkout → node --check → npm test → terraform fmt -check │ ──▶ plan (dev) + plan (prod)
 push to main ──▶   └──────────────────────────────────────────────────────┘ ──▶ deploy dev
 manual run   ──▶                                                              ──▶ deploy dev | prod (approval)

 deploy:  checkout → setup-terraform → init → validate → plan -out tfplan → apply tfplan
          → read outputs → smoke test (curl /api/health and /)
```

| Event | What happens |
|---|---|
| Pull request to `main` | Tests, then `terraform plan` for dev and prod. The plan summary is posted to the job page. Nothing changes. |
| Push to `main` | Tests, then plan and apply to **dev**, then a smoke test |
| Manual run (`workflow_dispatch`) | Choose dev or prod. Prod uses the GitHub Environment `production`, which can require a reviewer's approval |

### 8.2 Secrets and variables

| Name | Kind | Used as |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Provider authentication |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | `TF_VAR_account_id` |
| `CURATOR_API_KEY` | Secret | `TF_VAR_curator_api_key` |
| `TF_API_TOKEN` | Secret | HCP Terraform login (state) |
| `TF_CLOUD_ORGANIZATION` | Variable | HCP organisation |
| `WORKERS_SUBDOMAIN` | Variable | `TF_VAR_workers_subdomain` |

GitHub masks secrets in logs, and Terraform hides sensitive values in plan output.

### 8.3 Deployment strategy
- **Dev deploys continuously** on every merge to `main`, so the latest code is always running somewhere.
- **Prod deploys deliberately**, with a manual trigger and approval.
- The plan is saved (`-out tfplan`) and exactly that plan is applied, so nothing can change between plan and apply.
- `concurrency` per environment, together with HCP state locking, prevents two runs from changing the same environment at once.
- The smoke test fails the run if the deployed application does not answer.

*[Figure 8.1: `14-github-actions.png`]*

---

## Chapter 9 – Testing and Results

### 9.1 Unit tests (automated, run in CI)
`npm test` runs 23 tests against an in-memory KV mock:

| Group | Tests | Result |
|---|---|---|
| TC1 Create | ID generation, defaults, required fields, invalid enum/year/URL, malformed JSON | Pass |
| TC2 Read | Get one (case-insensitive ID), get all, 404 for unknown/invalid IDs | Pass |
| TC3 Update | Status change keeps other fields; `id`/`createdAt` protected; empty update rejected | Pass |
| TC4 Delete | Removes the record; second delete returns 404 | Pass |
| Curator access | 401 without or with a wrong key, `/api/auth`, 503 when not configured | Pass |
| Search/filter/sort/stats | Text search, category/status filters, 3 sort orders, stats, KV pagination | Pass |
| Config & static | `APP_CONFIG` exposed, health, static files with Content-Type, 404/405 | Pass |

### 9.2 Functional test cases (manual, on the deployed application)

| ID | Test | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|
| TC1 | Create artifact | Curator login → Add "Ajanta Cave Mural Fragment", Painting, Vakataka period, On Display | "Artifact ART-10xx successfully created" | *[Pass]* | `09-create.png` |
| TC2 | Read artifact | Open the card; `GET /api/artifacts/ART-10xx` | Details shown; JSON returned | *[Pass]* | |
| TC3 | Update artifact | Change status On Display → Under Restoration | "status changed"; tile count updates | *[Pass]* | `10-update.png` |
| TC4 | Delete artifact | Delete → confirm | "removed successfully"; GET returns 404 | *[Pass]* | `11-delete.png` |
| TC5 | Visitor cannot write | Logged out: `curl -X DELETE …` | 401 | *[Pass]* | |
| TC6 | Search & filter | Search "maratha"; filter Category = Coin | Only matching artifacts | *[Pass]* | |

### 9.3 Infrastructure lifecycle tests

| ID | Operation | Command | Expected | Actual | Evidence |
|---|---|---|---|---|---|
| IaC-1 | Initialise | `terraform init` | "successfully initialized" | *[ ]* | `02-…` |
| IaC-2 | Validate | `terraform validate` | "configuration is valid" | *[ ]* | `03-…` |
| IaC-3 | Plan | `terraform plan` | 7 to add | *[ ]* | `04-…` |
| IaC-4 | Provision | `terraform apply` | 7 added; URL output | *[ ]* | `05-…` |
| IaC-5 | Modify | change `museum_name`, `app_version` → plan/apply | 1 to change (in-place); UI shows new name | *[ ]* | `12-…` |
| IaC-6 | Drift | edit `index.html` in the dashboard → plan | Drift detected; apply restores it | *[ ]* | |
| IaC-7 | CI/CD | push title change | Pipeline green; site_files["index.html"] updated | *[ ]* | `14-…` |
| IaC-8 | Destroy | `terraform destroy` | 7 destroyed; URL gone | *[ ]* | `15-…` |
| IaC-9 | Recreate | `terraform apply` | 7 added; new namespace IDs; app works | *[ ]* | `16-…` |

### 9.4 Observations
- The full environment is created in well under a minute, and recreated just as quickly after destroy.
- After recreation, the KV namespace IDs are new and the collection is empty. Terraform restores **infrastructure** but not **data**, so data needs separate protection (backups, `prevent_destroy`).
- Frontend changes made through Git reach the live site through the pipeline without anyone touching the dashboard. KV edge caching can delay their appearance by up to about 60 seconds.

---

## Chapter 10 – Conclusion and Future Scope

### 10.1 Conclusion
The project delivers a working Digital Museum and Heritage Information System and, more importantly, shows that the application's whole cloud footprint can be expressed as code. Seven resources per environment (two KV namespaces, three website files, a Worker with four bindings, and its public URL) are created, updated, destroyed and recreated by Terraform alone. Modules and per-environment folders let the same code produce isolated dev and prod environments. Remote state, Git history and a GitHub Actions pipeline make every infrastructure change reviewable, repeatable and automatic. This meets every acceptance criterion of the specification as well as the optional enhancements (curator login, categories, search, filter, sorting, statistics, multiple environments, modules).

### 10.2 Future scope
- **Images in R2**: upload artifact photographs to a Terraform-managed Cloudflare R2 bucket instead of linking external URLs.
- **D1 (SQL) or Durable Objects** for strongly consistent writes and atomic ID generation.
- **Protect production data** with `lifecycle { prevent_destroy = true }` on the prod artifacts namespace, plus scheduled KV backups.
- **Custom domain** (e.g. `collection.museum.example`) with `cloudflare_workers_custom_domain`.
- **Proper authentication** (Cloudflare Access / OAuth) with per-curator audit logs.
- **Multilingual descriptions** (English, Hindi, Marathi) and accessibility improvements.
- **QR codes in galleries** that link each physical object to its digital record.
- **Policy as code and security scanning** in CI (e.g. tflint, Checkov).

---

## Answers to the Prescribed Questions

**1. What is Infrastructure as Code?**
IaC is the practice of defining and managing infrastructure (servers, storage, networking, configuration) in machine-readable files that are versioned and applied by a tool, instead of being set up by hand. In this project, `main.tf` and the modules *are* the definition of the museum's cloud environment.

**2. What problem does IaC solve?**
Manual setup is slow, error-prone, undocumented and hard to repeat. IaC makes environments reproducible (dev = prod), reviewable (pull requests), auditable (Git history), automatable (CI/CD) and quick to recover. This project's whole environment is recreated with one `terraform apply`.

**3. Why is Terraform called a declarative IaC tool?**
You describe *what* should exist ("a Worker named digital-museum-dev bound to namespace X"), not *how* to create it. Terraform compares that desired state with reality and works out the create, update or delete steps and their order.

**4. What is a Terraform provider?**
A plugin that translates Terraform resources into a specific platform's API calls. Here, `cloudflare/cloudflare` v5 calls the Cloudflare API to manage Workers and KV. `terraform init` downloads it.

**5. What is a Terraform resource?**
A block that declares one piece of infrastructure, such as `resource "cloudflare_workers_kv_namespace" "this" { ... }`. Terraform creates, updates and deletes it to match the code.

**6. What is a Terraform variable?**
An input parameter (`variable "environment" { default = "dev" }`) that makes code reusable. The same code builds dev and prod by changing variables. Values come from defaults, `terraform.tfvars`, `-var` or `TF_VAR_*` environment variables. Variables can be validated and marked `sensitive`.

**7. What is a Terraform output?**
A value Terraform prints after apply and makes available to other tools, such as `application_url` or the KV namespace IDs. The pipeline's smoke test reads `terraform output -raw application_url`.

**8. What is Terraform state?**
A JSON record that maps each resource in the code to the real object it created (for example, the namespace's Cloudflare ID) along with its attributes. Terraform uses it to plan changes. Here the state is stored remotely and locked in HCP Terraform, so the laptop and CI share it safely. It can contain secrets, so it is never committed to Git.

**9. What happens during `terraform init`?**
Terraform prepares the working directory. It downloads providers (matching `.terraform.lock.hcl`), installs modules (`../../modules/kv`, `worker`) and connects to the state backend (HCP workspace `museum-dev`).

**10. What happens during `terraform plan`?**
Terraform refreshes the current state from Cloudflare, compares it with the configuration, and shows the actions needed: `+` create, `~` update, `-` destroy, `-/+` replace. Nothing is changed. It is a preview.

**11. What happens during `terraform apply`?**
Terraform executes the plan, after confirmation or with a saved plan file. It calls the Cloudflare API in dependency order (namespaces before the Worker) and updates the state with the results.

**12. What happens during `terraform destroy`?**
Terraform plans and executes the deletion of every resource in the state, in reverse dependency order (the Worker route and Worker first, then the namespaces), and empties the state.

**13. Why should infrastructure not be modified manually after Terraform manages it?**
Manual changes cause drift. The code no longer describes reality, the next `apply` silently reverts the change, and nobody can see who made it or why. All changes should go through code, review and the pipeline.

**14. Why should API tokens not be stored in Terraform source code?**
Code goes into Git, and anything in Git history is effectively permanent and visible to everyone with access, including the whole internet for a public repository. A leaked Cloudflare token lets an attacker change or delete your infrastructure. Tokens belong in environment variables or a secret store (GitHub Secrets), are scoped to minimum permissions, and can be rotated.

**15. What is a KV database?**
A key-value database stores values under unique keys and looks them up by key, with no tables or joins. Workers KV is a globally replicated, eventually consistent KV store. This project stores each artifact as JSON under `artifact:<id>`.

**16. Why was serverless computing selected for this project?**
There are no servers to provision, patch or scale. It is free for this workload (100k requests/day), cold starts are fast, responses come from the edge near each visitor, billing is pay-per-use, and the infrastructure is small enough to express fully in Terraform. A museum catalogue has unpredictable, mostly read-only traffic, which suits serverless.

**17. What is CI/CD?**
Continuous Integration automatically tests every change merged into the main code line. Continuous Delivery/Deployment automatically releases changes that pass. This gives fast feedback, fewer manual errors and repeatable releases.

**18. What role does GitHub Actions perform?**
It is the automation engine. On every pull request it runs the tests and a Terraform plan. On every push to `main` it runs init, validate, plan and apply against Cloudflare using secrets stored in GitHub, then smoke-tests the deployed site. Nobody needs to run Terraform by hand to deploy.

**19. How can Terraform recreate infrastructure after deletion?**
The complete desired state is in the configuration files. After `destroy`, the state is empty, so `plan` finds that every declared resource is missing and proposes to create them all. `apply` rebuilds the environment exactly as described. The new namespaces get new IDs, which Terraform wires into the Worker bindings automatically.

**20. What is infrastructure drift?**
Drift is any difference between the real infrastructure and the Terraform configuration or state, usually caused by manual changes in a dashboard. `terraform plan` detects it, and `apply` reconciles it. The demo edits `index.html` in the KV dashboard and shows Terraform detect and revert it.

---

## Viva Preparation

| # | Question | Short answer |
|---|---|---|
| Q1 | What is IaC? | Managing infrastructure through version-controlled definition files instead of manual setup |
| Q2 | IaC tool used? | Terraform 1.16 with the Cloudflare provider v5 |
| Q3 | Cloud provider? | Cloudflare (free plan) |
| Q4 | Compute service? | Cloudflare Workers (serverless) |
| Q5 | Storage service? | Workers KV: 2 namespaces, records and website files |
| Q6 | `terraform init`? | Downloads the provider, installs modules, connects to HCP state |
| Q7 | `terraform plan`? | Compares code with state and reality, and shows proposed changes |
| Q8 | `terraform apply`? | Executes the changes and updates the state |
| Q9 | `terraform destroy`? | Deletes all managed resources in reverse dependency order |
| Q10 | State? | The mapping of code to real resource IDs, kept remotely in HCP Terraform |
| Q11 | Drift? | Reality differs from the code, e.g. after a manual dashboard edit |
| Q12 | Manual change to a managed resource? | The next plan shows it, and apply reverts it to match the code |
| Q13 | Why variables? | Reuse: the same code for dev and prod; no hard-coding; validation |
| Q14 | Why modules? | `kv` used twice, `worker` once per environment: reusable, consistent building blocks |
| Q15 | Git for IaC? | History, review, rollback, audit, collaboration, and the trigger for CI/CD |

**Likely follow-up questions**
- *Why two KV namespaces?* Records and website files have different lifecycles. Keeping them apart means listing artifacts never touches HTML, and the site files are fully owned by Terraform.
- *Why remote state?* The laptop and CI both run Terraform. With local state, CI wouldn't know the resources exist and would try to create duplicates. HCP also locks the state during a run.
- *Why is `-/+` shown when renaming the Worker?* The script name is the Worker's identity. Terraform must delete the old one and create a new one.
- *Where is the curator key stored?* In GitHub Secrets and the local environment, passed as `TF_VAR_curator_api_key`, stored by Cloudflare as an encrypted secret binding, and hidden in plan output.
- *What does the `.terraform.lock.hcl` file do?* It pins the exact provider version and checksums, so every machine and CI run uses an identical provider.
- *What if two pipeline runs overlap?* GitHub `concurrency` queues them, and HCP Terraform's state lock prevents simultaneous applies.

---

## References
1. HashiCorp, *Terraform Documentation*: https://developer.hashicorp.com/terraform/docs
2. Cloudflare, *Terraform provider*: https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs
3. Cloudflare, *Workers documentation*: https://developers.cloudflare.com/workers/
4. Cloudflare, *Workers KV documentation*: https://developers.cloudflare.com/kv/
5. Cloudflare, *Infrastructure as Code for Workers*: https://developers.cloudflare.com/workers/platform/infrastructure-as-code/
6. GitHub, *GitHub Actions documentation*: https://docs.github.com/actions
7. P. Mell, T. Grance, *The NIST Definition of Cloud Computing*, NIST SP 800-145, 2011.
