# Terraform settings and the Cloudflare provider for the DEV environment.
#
# Credentials are NOT written here:
#   - CLOUDFLARE_API_TOKEN   environment variable, read by the provider
#   - TF_CLOUD_ORGANIZATION  environment variable, read by the cloud block
#   - HCP Terraform login    `terraform login` locally, TF_API_TOKEN in CI

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }

  # Remote state in HCP Terraform, shared by your laptop and GitHub Actions.
  # Set the workspace's Execution Mode to "Local": HCP only stores the state
  # and locks it; Terraform itself runs on your machine or the CI runner.
  cloud {
    workspaces {
      name = "museum-dev"
    }
  }
}

provider "cloudflare" {
  # api_token is read from the CLOUDFLARE_API_TOKEN environment variable.
}
