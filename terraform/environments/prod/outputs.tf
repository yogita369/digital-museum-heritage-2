# Values printed after `terraform apply` (and by `terraform output`).

output "environment" {
  description = "Environment that was deployed."
  value       = var.environment
}

output "worker_name" {
  description = "Name of the Cloudflare Worker script."
  value       = module.museum_app.script_name
}

output "artifacts_kv_namespace_id" {
  description = "ID of the KV namespace holding artifact records."
  value       = module.artifacts_kv.id
}

output "site_kv_namespace_id" {
  description = "ID of the KV namespace holding the website files."
  value       = module.site_kv.id
}

output "site_files" {
  description = "Website files uploaded by Terraform."
  value       = module.museum_app.site_file_keys
}

output "application_url" {
  description = "Open this URL to use the application."
  value       = module.museum_app.url
}
