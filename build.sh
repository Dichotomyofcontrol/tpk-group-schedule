#!/bin/bash
# Build script: replaces placeholders in index.html with Vercel environment variables
# This runs at deploy time so secrets never live in the repo

cp index.html index.html.bak

sed -i "s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g" index.html
sed -i "s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g" index.html
sed -i "s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g" index.html
sed -i "s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g" index.html
sed -i "s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g" index.html
sed -i "s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g" index.html
sed -i "s|__SITE_PASSPHRASE__|${SITE_PASSPHRASE}|g" index.html

# Inject the same Firebase config into the pre-built Iven Forge bundle (/iven), so its real
# config never lives in the repo either. Only the one config chunk carries the placeholders;
# sed-ing every /iven JS file is a harmless no-op on the rest.
if [ -d iven ]; then
  find iven -type f -name "*.js" -print0 | xargs -0 sed -i \
    -e "s|__FIREBASE_API_KEY__|${FIREBASE_API_KEY}|g" \
    -e "s|__FIREBASE_AUTH_DOMAIN__|${FIREBASE_AUTH_DOMAIN}|g" \
    -e "s|__FIREBASE_PROJECT_ID__|${FIREBASE_PROJECT_ID}|g" \
    -e "s|__FIREBASE_STORAGE_BUCKET__|${FIREBASE_STORAGE_BUCKET}|g" \
    -e "s|__FIREBASE_MESSAGING_SENDER_ID__|${FIREBASE_MESSAGING_SENDER_ID}|g" \
    -e "s|__FIREBASE_APP_ID__|${FIREBASE_APP_ID}|g"
  echo "Build complete — env vars injected into index.html + /iven bundle"
else
  echo "Build complete — env vars injected into index.html"
fi
