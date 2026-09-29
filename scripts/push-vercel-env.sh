#!/usr/bin/env bash
# -------------------------------------------------------
# Push Prompt AI environment variables to Vercel
#
# Prerequisites:
#   1. vercel login   (use your Prompt AI account, not riosintell)
#   2. vercel link    (from inside /app directory, link the deployed project)
#   3. Fill in the values below before running
# -------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../app"

# ---- Values -------------------------------------------------------
SUPABASE_URL="https://cglrkliewuidvdkfnivf.supabase.co"
SUPABASE_ANON_KEY="<your-anon-key-from-supabase-dashboard>"
API_URL="https://<your-deployed-api-url>"
SITE_URL="https://prompt-swe.vercel.app"
# -------------------------------------------------------------------

for ENV in production preview development; do
  echo "→ pushing to $ENV..."
  echo "$SUPABASE_URL"       | vercel env add NEXT_PUBLIC_SUPABASE_URL       "$ENV" --force
  echo "$SUPABASE_ANON_KEY"  | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  "$ENV" --force
  echo "$API_URL"             | vercel env add NEXT_PUBLIC_API_URL             "$ENV" --force
  echo "$SITE_URL"            | vercel env add NEXT_PUBLIC_SITE_URL            "$ENV" --force
done

echo "✓ Done. Run 'vercel --prod' from /app to redeploy."
