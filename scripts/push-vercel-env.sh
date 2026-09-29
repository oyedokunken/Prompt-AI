#!/usr/bin/env bash
# -------------------------------------------------------
# Push Prompt AI environment variables to Vercel
#
# Prerequisites:
#   1. vercel login  →  log in as oyedokunken
#   2. cd app && vercel link  →  link to the prompt-swe Vercel project
#   3. run this script from the repo root
# -------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../app"

# ---- Values -------------------------------------------------------
SUPABASE_URL="https://cglrkliewuidvdkfnivf.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnbHJrbGlld3VpZHZka2ZuaXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTI0OTQsImV4cCI6MjEwNTE2ODQ5NH0.Xgw3crDHR8yduwKHneV5ArwzsKoOg8etJ2QJn_Xz5MI"
API_URL="https://prompt-api.vercel.app"   # update if your API is deployed elsewhere
SITE_URL="https://prompt-swe.vercel.app"
# -------------------------------------------------------------------

for ENV in production preview development; do
  echo "→ pushing to $ENV..."
  echo "$SUPABASE_URL"      | vercel env add NEXT_PUBLIC_SUPABASE_URL      "$ENV" --force
  echo "$SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$ENV" --force
  echo "$API_URL"            | vercel env add NEXT_PUBLIC_API_URL            "$ENV" --force
  echo "$SITE_URL"           | vercel env add NEXT_PUBLIC_SITE_URL           "$ENV" --force
done

echo "✓ Done. Run 'vercel --prod' from inside /app to redeploy."
