#!/usr/bin/env bash
# Setup script for the ultimate-native-ide development environment.
# Installs + builds the vendored DSH and links its packages so the Agent Host
# can import the real DSH kernel.
#
# Run from the repo root: ./scripts/setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1. Install workspace dependencies ==="
pnpm install

echo "=== 2. Install vendored DSH dependencies ==="
cd vendor/dsh
pnpm install

echo "=== 3. Build vendored DSH host lib ==="
pnpm run build:lib:host

echo "=== 4. Link DSH packages into root node_modules ==="
cd "$ROOT"
mkdir -p node_modules/@deepseek-ai
cd node_modules/@deepseek-ai

# Link all DSH packages (only those with built lib/)
for dir in "$ROOT"/vendor/dsh/packages/*/*; do
  [ -f "$dir/lib/index.js" ] || continue
  pkgname=$(grep -m1 '"name"' "$dir/package.json" 2>/dev/null | sed 's/.*"name": "//;s/".*//')
  [ -z "$pkgname" ] && continue
  [[ "$pkgname" != @deepseek-ai/* ]] && continue
  bn="${pkgname#@deepseek-ai/}"
  ln -sfn "$dir" "$bn"
done

# Link vendored framework packages (cordis etc.)
for dir in "$ROOT"/vendor/dsh/vendor/*; do
  [ -f "$dir/lib/index.js" ] || continue
  pkgname=$(grep -m1 '"name"' "$dir/package.json" 2>/dev/null | sed 's/.*"name": "//;s/".*//')
  [ -z "$pkgname" ] && continue
  [[ "$pkgname" != @deepseek-ai/* ]] && continue
  bn="${pkgname#@deepseek-ai/}"
  ln -sfn "$dir" "$bn"
done
echo "  linked $(ls | wc -l) packages"

echo "=== 5. Create DSH home + agent-host profile ==="
DSH_HOME="$ROOT/.dsh-home"
mkdir -p "$DSH_HOME/profiles/agent-host"
cat > "$DSH_HOME/profiles/agent-host/package.json" << 'PKGJSON'
{
  "name": "dsh-profile-agent-host",
  "private": true,
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base"]
    }
  }
}
PKGJSON
cat > "$DSH_HOME/profiles/agent-host/cordis.yml" << 'YML'
# agent-host profile: dsh-base only (no one-shot runner, no web UI).
[]
YML
cat > "$DSH_HOME/profiles/agent-host/cordis.patch.yml" << 'YML'
# Patch layer: keep the base composition, suppress nothing.
[]
YML

echo "=== 6. Link DSH packages into profile node_modules ==="
mkdir -p "$DSH_HOME/profiles/node_modules/@deepseek-ai"
cd "$DSH_HOME/profiles/node_modules/@deepseek-ai"
for dir in "$ROOT"/vendor/dsh/packages/*/*; do
  [ -f "$dir/lib/index.js" ] || continue
  pkgname=$(grep -m1 '"name"' "$dir/package.json" 2>/dev/null | sed 's/.*"name": "//;s/".*//')
  [ -z "$pkgname" ] && continue
  [[ "$pkgname" != @deepseek-ai/* ]] && continue
  bn="${pkgname#@deepseek-ai/}"
  ln -sfn "$dir" "$bn"
done
for dir in "$ROOT"/vendor/dsh/vendor/*; do
  [ -f "$dir/lib/index.js" ] || continue
  pkgname=$(grep -m1 '"name"' "$dir/package.json" 2>/dev/null | sed 's/.*"name": "//;s/".*//')
  [ -z "$pkgname" ] && continue
  [[ "$pkgname" != @deepseek-ai/* ]] && continue
  bn="${pkgname#@deepseek-ai/}"
  ln -sfn "$dir" "$bn"
done
echo "  linked $(ls | wc -l) profile packages"

echo ""
echo "=== Setup complete ==="
echo "Run tests: pnpm test"
echo "DSH_HOME: $DSH_HOME"
