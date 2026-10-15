variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "script_name" {
  description = "Worker script name. Also becomes the first part of the workers.dev URL."
  type        = string
}

variable "application_dir" {
  description = "Path to the application/ folder containing worker.js and the website files."
  type        = string
}

variable "site_files" {
  description = "Website files (relative to application_dir) uploaded into the site KV namespace."
  type        = list(string)
  default     = ["index.html", "style.css", "script.js"]
}

variable "compatibility_date" {
  description = "Workers runtime compatibility date."
  type        = string
}

variable "artifacts_kv_namespace_id" {
  description = "ID of the KV namespace that stores artifact records."
  type        = string
}

variable "site_kv_namespace_id" {
  description = "ID of the KV namespace that stores the website files."
  type        = string
}

variable "environment" {
  description = "Deployment environment name, exposed to the Worker in APP_CONFIG."
  type        = string
}

variable "museum_name" {
  description = "Museum name shown in the UI, exposed to the Worker in APP_CONFIG."
  type        = string
}

variable "app_version" {
  description = "Application version shown in the UI, exposed to the Worker in APP_CONFIG."
  type        = string
}

variable "curator_api_key" {
  description = "Secret key required for create/update/delete. Exposed to the Worker as CURATOR_API_KEY."
  type        = string
  sensitive   = true
}

variable "workers_subdomain" {
  description = "Account's workers.dev subdomain, used only to build the application URL output."
  type        = string
}
