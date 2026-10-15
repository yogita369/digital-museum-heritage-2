variable "account_id" {
  description = "Cloudflare account ID that owns the namespace."
  type        = string
}

variable "title" {
  description = "Human-readable namespace name shown in the Cloudflare dashboard."
  type        = string

  validation {
    condition     = length(var.title) > 0 && length(var.title) <= 512
    error_message = "KV namespace title must be between 1 and 512 characters."
  }
}
