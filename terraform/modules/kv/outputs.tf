output "id" {
  description = "Namespace ID, used to bind the namespace to a Worker."
  value       = cloudflare_workers_kv_namespace.this.id
}

output "title" {
  description = "Namespace title."
  value       = cloudflare_workers_kv_namespace.this.title
}
