# Reusable module: one Cloudflare Workers KV namespace.
# Called twice per environment - once for artifact records and once for the
# website files - so both namespaces are created the same way.

resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.account_id
  title      = var.title
}
