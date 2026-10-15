# PROD environment of the Digital Museum and Heritage Information System.
#
#   Terraform
#     |-- module.artifacts_kv  -> KV namespace  museum-artifacts-prod (artifact records)
#     |-- module.site_kv       -> KV namespace  museum-site-prod      (website files)
#     `-- module.museum_app    -> Worker        digital-museum-prod
#                                 + bindings to both namespaces + config + secret
#                                 + website files uploaded to museum-site-prod
#                                 + workers.dev URL

locals {
  application_dir = "${path.module}/../../../application"
}

module "artifacts_kv" {
  source = "../../modules/kv"

  account_id = var.account_id
  title      = "${var.kv_namespace_name}-${var.environment}"
}

module "site_kv" {
  source = "../../modules/kv"

  account_id = var.account_id
  title      = "${var.site_kv_namespace_name}-${var.environment}"
}

module "museum_app" {
  source = "../../modules/worker"

  account_id         = var.account_id
  script_name        = "${var.worker_name}-${var.environment}"
  application_dir    = local.application_dir
  compatibility_date = var.compatibility_date

  artifacts_kv_namespace_id = module.artifacts_kv.id
  site_kv_namespace_id      = module.site_kv.id

  environment       = var.environment
  museum_name       = var.museum_name
  app_version       = var.app_version
  curator_api_key   = var.curator_api_key
  workers_subdomain = var.workers_subdomain
}
