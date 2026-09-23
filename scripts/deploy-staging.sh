#!/bin/zsh
# Deploy Kalm seeding STAGING and keep the permanent link pointing at the new build.
# Permanent link: https://kalm-seeding.vercel.app (behind Vercel deployment protection).
set -e
cd "$(dirname "$0")/.."
URL=$(npx vercel deploy --yes 2>&1 | grep -oE 'https://kalm-seeding-staging-[a-z0-9]+-kamordonez\.vercel\.app' | head -1)
[ -n "$URL" ] || { echo "Deploy failed: no deployment URL returned."; exit 1; }
npx vercel alias set "$URL" kalm-seeding.vercel.app >/dev/null
echo "Deployed $URL"
echo "Live at https://kalm-seeding.vercel.app"
