# Reusable module: the Museum application on Cloudflare Workers.
#
# Creates:
#   1. One KV entry per website file (index.html, style.css, script.js) in
#      the site namespace. Editing a file shows up as a Terraform change.
#   2. The Worker script, with bindings to both KV namespaces, JSON
#      configuration and the curator secret.
#   3. The workers.dev route, so the app is reachable at
#      https://<script_name>.<workers_subdomain>.workers.dev

resource "cloudflare_workers_kv" "site_files" {
  for_each = toset(var.site_files)

  account_id   = var.account_id
  namespace_id = var.site_kv_namespace_id
  key_name     = each.value
  value        = file("${var.application_dir}/${each.value}")
}

resource "cloudflare_workers_script" "this" {
  account_id         = var.account_id
  script_name        = var.script_name
  content            = file("${var.application_dir}/worker.js")
  main_module        = "worker.js"
  compatibility_date = var.compatibility_date

  bindings = [
    # Worker <-> KV bindings: the Worker reads these as env.ARTIFACTS_KV and env.SITE_ASSETS
    {
      name         = "ARTIFACTS_KV"
      type         = "kv_namespace"
      namespace_id = var.artifacts_kv_namespace_id
    },
    {
      name         = "SITE_ASSETS"
      type         = "kv_namespace"
      namespace_id = var.site_kv_namespace_id
    },
    # Configuration from Terraform variables, read by the Worker as env.APP_CONFIG.
    # A JSON binding (unlike plain_text) is shown in full in `terraform plan`,
    # so configuration changes are easy to see during the modify demo.
    {
      name = "APP_CONFIG"
      type = "json"
      json = jsonencode({
        environment = var.environment
        museumName  = var.museum_name
        version     = var.app_version
      })
    },
    # Secret: encrypted by Cloudflare, never visible in the dashboard or the code
    {
      name = "CURATOR_API_KEY"
      type = "secret_text"
      text = var.curator_api_key
    },
  ]

  # Workers Logs (free). All values are spelled out because Cloudflare fills in
  # any that are left out, which would make every `terraform plan` show a change.
  observability = {
    enabled            = true
    head_sampling_rate = 1
    logs = {
      enabled            = true
      head_sampling_rate = 1
      invocation_logs    = true
      persist            = true
    }
    traces = {
      enabled            = false
      head_sampling_rate = 1
      persist            = true
    }
  }

  # Upload the website files before the Worker that serves them goes live.
  depends_on = [cloudflare_workers_kv.site_files]
}

resource "cloudflare_workers_script_subdomain" "this" {
  account_id       = var.account_id
  script_name      = cloudflare_workers_script.this.script_name
  enabled          = true
  previews_enabled = false
}
