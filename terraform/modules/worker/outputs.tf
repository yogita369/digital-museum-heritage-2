output "script_name" {
  description = "Deployed Worker script name."
  value       = cloudflare_workers_script.this.script_name
}

output "url" {
  description = "Public workers.dev URL of the application."
  value       = "https://${cloudflare_workers_script_subdomain.this.script_name}.${var.workers_subdomain}.workers.dev"
}

output "site_file_keys" {
  description = "Website files stored in the site KV namespace."
  value       = sort(keys(cloudflare_workers_kv.site_files))
}
