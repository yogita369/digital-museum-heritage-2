# Loads .env into the CURRENT shell so plain `terraform` commands work
# (e.g. during the viva demo). Bash / zsh / Git Bash / WSL / macOS.
#
# Run from the project root:
#   source scripts/load-env.sh
#   cd terraform/environments/dev
#   terraform plan

if [ ! -f .env ]; then
  echo "No .env in $(pwd). Run this from the project root, after: node scripts/doctor.mjs --init-env"
  return 1 2>/dev/null || exit 1
fi

set -a
. ./.env
set +a

export TF_TOKEN_app_terraform_io="$TF_API_TOKEN"
export TF_VAR_account_id="$CLOUDFLARE_ACCOUNT_ID"
export TF_VAR_workers_subdomain="$WORKERS_SUBDOMAIN"
export TF_VAR_curator_api_key="$CURATOR_API_KEY"

echo "Loaded .env into this shell (values hidden). Terraform credentials and TF_VAR_* are set."
