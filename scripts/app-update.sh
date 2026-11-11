#!/bin/bash
# Sends an over-the-air update to the installed mobile apps (no new build).
# Usage: scripts/app-update.sh client|driver|both "What changed"
# Only for changes to screens, wording and logic. A change that adds or upgrades a
# native library needs a new build AND a higher "version" in that app's app.json,
# so phones on the old build never receive code they cannot run.
set -e
what="$1"; msg="$2"
[ -z "$msg" ] && { echo "Usage: scripts/app-update.sh client|driver|both \"What changed\""; exit 1; }
root="$(cd "$(dirname "$0")/.." && pwd)"
case "$what" in client|driver) apps="$what" ;; both) apps="client driver" ;; *) echo "First argument: client, driver or both"; exit 1 ;; esac
for a in $apps; do
  echo "== $a"
  (cd "$root/apps/$a" && npx -y eas-cli update --channel main --environment production --message "$msg" --non-interactive)
done
