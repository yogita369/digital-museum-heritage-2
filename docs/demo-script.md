# Viva demonstration script

This follows the 20 mandatory demonstration steps of the project specification (section 30), in order. Each step gives the command to run, what you should see, and one or two sentences to say.

**Before the viva**
- Rehearse once, end to end, the day before.
- Have the dev environment **destroyed**, so step 5 creates everything live in front of the examiner. Alternatively, keep it running and start from step 6.
- Open these in browser tabs: the GitHub repository, its Actions tab, Cloudflare dashboard → Workers & Pages, Cloudflare → Storage & Databases → KV, and HCP Terraform → `museum-dev` workspace.
- In the terminal, from the project root: `source scripts/load-env.sh` (PowerShell: `. .\scripts\load-env.ps1`), then `cd terraform/environments/dev`.
- Keep `docs/report.md` §"Questions" open for reference.

---

### 1. Show Terraform source code
Open in the editor, in this order: `environments/dev/providers.tf` → `variables.tf` → `main.tf` → `modules/kv/main.tf` → `modules/worker/main.tf` → `outputs.tf`.

> "`providers.tf` says which provider Terraform needs, Cloudflare v5, and where state is kept, HCP Terraform. `main.tf` calls two reusable modules. The `kv` module is used twice: one namespace for artifact records and one for the website files. The `worker` module creates the Worker, its bindings and its public URL, and uploads the three website files. No token is written anywhere. The provider reads it from an environment variable."

Point at the `bindings` block: "This is the Worker-to-KV binding. The Worker sees the namespace as `env.ARTIFACTS_KV`."

### 2. `terraform validate`
```bash
terraform init      # if not done yet: shows the Cloudflare provider being downloaded
terraform validate
```
Expected: `Success! The configuration is valid.`
> "validate checks syntax, types and references, such as a module output that doesn't exist, without contacting Cloudflare."

### 3. `terraform plan`
```bash
terraform plan
```
Expected: `Plan: 7 to add, 0 to change, 0 to destroy.`

### 4. Explain the plan
Scroll and point to each `+`:

| Address in plan | What it is |
|---|---|
| `module.artifacts_kv.cloudflare_workers_kv_namespace.this` | KV namespace `museum-artifacts-dev`, the database |
| `module.site_kv.cloudflare_workers_kv_namespace.this` | KV namespace `museum-site-dev`, the website files |
| `module.museum_app.cloudflare_workers_kv.site_files["index.html"]` (and style.css, script.js) | The three frontend files, created with `for_each` |
| `module.museum_app.cloudflare_workers_script.this` | Worker `digital-museum-dev` with 4 bindings |
| `module.museum_app.cloudflare_workers_script_subdomain.this` | Public URL on workers.dev |

> "`+` means create, `~` means update in place, `-` means destroy, and `-/+` means destroy then recreate. The namespace IDs show as *(known after apply)* because Cloudflare assigns them. Terraform builds a dependency graph, so it creates the namespaces before the Worker that binds to them. The curator key shows as *(sensitive value)*, so it never appears in logs."

### 5. `terraform apply`
```bash
terraform apply     # type: yes
```
Expected: `Apply complete! Resources: 7 added, 0 changed, 0 destroyed.` followed by the outputs, including `application_url`.

Optionally load the sample collection:
```bash
node ../../../scripts/seed-sample-data.mjs
```

### 6. Show the Worker that was created
Cloudflare dashboard → **Workers & Pages** → `digital-museum-dev` → **Settings → Bindings**. You should see `ARTIFACTS_KV`, `SITE_ASSETS`, `APP_CONFIG` and `CURATOR_API_KEY` (value hidden).
> "I didn't create this in the dashboard. Terraform did, a minute ago."

### 7. Show the KV namespaces that were created
**Storage & Databases → KV** → `museum-artifacts-dev` and `museum-site-dev`. Open `museum-site-dev` to show the three file keys. Compare the namespace IDs with `terraform output`.

### 8. Open the deployed application
```bash
terraform output -raw application_url
```
Open the URL. Point out the header badge **DEV** and the version: these come from Terraform variables through the `APP_CONFIG` binding.

### 9. Add an artifact (Test Case 1)
Click **Curator login** and enter the curator key. Then **+ Add artifact**:

| Field | Value |
|---|---|
| Name | Ajanta Cave Mural Fragment |
| Category | Painting |
| Era | Vakataka period, 5th century CE |
| Status | On Display |

Expected toast: **"Artifact ART-10xx successfully created"**. The stats tiles update.

### 10. Retrieve the artifact (Test Case 2)
Click the card to open its details. Also show the raw API in a new tab: `<url>/api/artifacts/ART-10xx`.
> "The browser calls the REST API. The Worker reads the record from KV with `env.ARTIFACTS_KV.get(...)`."

Optionally, show the record in the dashboard: KV `museum-artifacts-dev` → key `artifact:ART-10xx`.

### 11. Update the artifact (Test Case 3)
On the card, change the status dropdown from **On Display** to **Under Restoration**.
Expected toast: **status changed to "Under Restoration"**. The "Under Restoration" tile goes up by one.

### 12. Delete the artifact (Test Case 4)
Click **Delete** on the card and confirm. Expected toast: **"Artifact ART-10xx removed successfully"**. `GET /api/artifacts/ART-10xx` now returns 404.

### 13. Modify the Terraform configuration
In `environments/dev/variables.tf`, change the defaults:
```hcl
variable "museum_name" { ... default = "National Heritage Museum - Cloud Edition" }
variable "app_version" { ... default = "1.1.0" }
```

### 14. `terraform plan` again
```bash
terraform plan
```
Expected: `Plan: 0 to add, 1 to change, 0 to destroy.`, and on `cloudflare_workers_script.this`:
```
~ resource "cloudflare_workers_script" "this" {
    ~ bindings = [
        ~ {
            ~ json = jsonencode(
                ~ {
                    ~ museumName  = "National Heritage Museum - Development" -> "National Heritage Museum - Cloud Edition"
                    ~ version     = "1.0.0" -> "1.1.0"
```

### 15. Explain the detected difference
> "Terraform compared three things: the code (desired state), the state file (what it created last time), and the real Worker on Cloudflare. Only the `APP_CONFIG` binding differs, so it updates that one resource in place. It doesn't touch the KV namespaces, so no data is lost."

**Optional extra: show a replacement.** Change `worker_name` to `heritage-museum` and run `plan`. The Worker shows `-/+ must be replaced`, because a Worker's name is its identity and can't be changed in place. Revert the change before continuing.

**Optional extra: show drift (viva Q11/Q12).** In the dashboard, open KV `museum-site-dev` → `index.html` → edit the value by hand (e.g. change the `<h1>` text) and save. Then:
```bash
terraform plan    # ~ site_files["index.html"] will be updated in-place
```
> "That manual change is *infrastructure drift*. Terraform detected it by refreshing the real value, and `apply` puts back what the code says. This is why Terraform-managed resources shouldn't be edited by hand."

### 16. Apply the modification
```bash
terraform apply   # yes
```
Refresh the application: the header shows the new museum name and **v1.1.0**.

Commit it: `git commit -am "Rename museum and bump version to 1.1.0"`.

### 17. Show the GitHub repository
Show the file tree, `.gitignore` (state, tfvars and plans excluded), and **commit history** (`git log --oneline`). Show that `terraform.tfvars` is *not* in the repository.

### 18. Show the GitHub Actions pipeline
Edit `application/index.html` and change the `<h1>` to **Cloud-Based Digital Museum and Heritage Information System**. Then:
```bash
git add application/index.html
git commit -m "Update application title"
git push
```
Open **Actions**. The run goes `test` → `Deploy (dev)`. Open the `terraform plan` step: `~ site_files["index.html"] will be updated in-place`. When it's green, refresh the app to see the new title.
> "Nobody ran Terraform by hand. The push triggered GitHub Actions, which ran init, validate, plan and apply with credentials from GitHub Secrets, then a smoke test against `/api/health`. Because state is in HCP Terraform, the pipeline and my laptop see the same infrastructure."

### 19. `terraform destroy`
```bash
terraform plan -destroy    # Plan: 0 to add, 0 to change, 7 to destroy.
terraform destroy          # yes  ->  Destroy complete! Resources: 7 destroyed.
```
Refresh the dashboard: the Worker and both namespaces are gone. The app URL no longer responds.

### 20. Recreate the infrastructure
```bash
terraform plan     # Plan: 7 to add (same as step 3)
terraform apply    # yes  ->  Apply complete! Resources: 7 added
terraform output   # note: NEW KV namespace IDs
```
Open the URL. The application is back, with an empty collection.
> "The whole environment came back from code alone, with no dashboard clicks. The collection is empty because destroy deleted the KV namespace, and the data with it. Terraform recreates *infrastructure*, not *data*. In production you would protect the data namespace with `lifecycle { prevent_destroy = true }` and take backups."

Re-seed if you want to continue: `node ../../../scripts/seed-sample-data.mjs`.

---

### Bonus: multiple environments (if time allows)
```bash
cd ../prod
terraform init && terraform plan   # 7 to add: museum-artifacts-prod, digital-museum-prod, ...
```
> "Same modules, different variables and a separate state workspace. Dev and prod can't affect each other."
