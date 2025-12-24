#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# --- CONFIGURATION ---
REGISTRY_URL="registry.npmjs.org"
DIST_TAG="nightly"
DRY_RUN=false

# --- ARGUMENT PARSING ---
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      echo "[INFO] Dry run enabled. No changes will be published."
      ;;
  esac
done

# --- HELPER FUNCTIONS ---
log_json() {
  # This creates a structured JSON block specifically for your AI agent to parse
  echo ""
  echo "---RESULT-JSON---"
  echo "{\"status\": \"$1\", \"version\": \"$2\", \"error\": \"$3\", \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
  echo "-----------------"
}

cleanup() {
  # Cleanup .npmrc to prevent leaking tokens if the env persists
  rm -f .npmrc
  # Discard changes to package.json (the version bump)
  git checkout package.json 2>/dev/null || true
}
trap cleanup EXIT

# --- MAIN LOGIC ---

echo "[INFO] Starting Nightly Deployment..."

# 1. Validation: Check for NPM_TOKEN
if [ -z "$NPM_TOKEN" ]; then
  if [ "$DRY_RUN" = true ]; then
    echo "[WARN] NPM_TOKEN environment variable is missing, but continuing in dry-run mode."
    NPM_TOKEN="DUMMY_TOKEN_FOR_DRY_RUN"
  else
    echo "[ERROR] NPM_TOKEN environment variable is missing."
    log_json "failed" "null" "Missing NPM_TOKEN"
    exit 1
  fi
fi

# 2. Authentication: Setup .npmrc
# We write this locally to authenticate the session
echo "[INFO] Configuring registry authentication..."
echo "//$REGISTRY_URL/:_authToken=${NPM_TOKEN}" > .npmrc

# 3. Versioning: Calculate Snapshot Version
# We use node -p to read the current version to avoid needing 'jq'
CURRENT_VERSION=$(node -p "require('./package.json').version")
COMMIT_SHA=$(git rev-parse --short HEAD)
DATE_SUFFIX=$(date +%Y%m%d%H%M%S)

# Construct version: 1.2.0-nightly-abc1234-20231027
SNAPSHOT_VERSION="${CURRENT_VERSION}-${DIST_TAG}-${COMMIT_SHA}-${DATE_SUFFIX}"

echo "[INFO] Base Version: $CURRENT_VERSION"
echo "[INFO] Target Snapshot: $SNAPSHOT_VERSION"

# 4. Apply Version
# --no-git-tag-version prevents git tags/commits
# --force allows downgrading if the nightly version looks "older" semantically
npm version "$SNAPSHOT_VERSION" --no-git-tag-version --force

# 5. Test and Build
npm test
npm run build
npm run test:smoke

# 6. Publish
echo "[INFO] Publishing to npm with tag '$DIST_TAG'..."

if [ "$DRY_RUN" = true ]; then
  echo "[DRY-RUN] Would execute: npm publish --tag \"$DIST_TAG\""
else
  npm publish --tag "$DIST_TAG"
fi

# 7. Success Reporting
echo "[SUCCESS] Published $SNAPSHOT_VERSION"
log_json "success" "$SNAPSHOT_VERSION" "null"
