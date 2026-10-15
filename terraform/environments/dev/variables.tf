# Input variables for the DEV environment.
# Values come from (highest priority first): -var flags, TF_VAR_<name>
# environment variables, terraform.tfvars, then the defaults below.

variable "account_id" {
  description = "Cloudflare account ID (Dashboard -> Workers & Pages -> Account details)."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.account_id))
    error_message = "account_id must be the 32-character hexadecimal Cloudflare account ID."
  }
}

variable "workers_subdomain" {
  description = "Your account's workers.dev subdomain: the <name> in <name>.workers.dev."
  type        = string
}

variable "curator_api_key" {
  description = "Secret key curators type into the UI to add, edit or delete artifacts."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.curator_api_key) >= 12
    error_message = "curator_api_key must be at least 12 characters long."
  }
}

variable "environment" {
  description = "Deployment environment. Added as a suffix to every resource name."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "environment must be one of: dev, test, prod."
  }
}

variable "worker_name" {
  description = "Base name of the Worker script. The final name is <worker_name>-<environment>."
  type        = string
  default     = "digital-museum"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{0,40}[a-z0-9]$", var.worker_name))
    error_message = "worker_name may contain only lowercase letters, digits and hyphens."
  }
}

variable "kv_namespace_name" {
  description = "Base name of the KV namespace that stores artifact records."
  type        = string
  default     = "museum-artifacts"
}

variable "site_kv_namespace_name" {
  description = "Base name of the KV namespace that stores the website files."
  type        = string
  default     = "museum-site"
}

variable "museum_name" {
  description = "Museum name displayed in the application header."
  type        = string
  default     = "National Heritage Museum - Development"
}

variable "app_version" {
  description = "Application version displayed in the application header."
  type        = string
  default     = "1.0.0"
}

variable "compatibility_date" {
  description = "Cloudflare Workers runtime compatibility date."
  type        = string
  default     = "2026-09-01"
}
