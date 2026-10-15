# Child modules must say where the provider comes from; otherwise Terraform
# would look for "hashicorp/cloudflare". The version is pinned by the caller.
terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}
