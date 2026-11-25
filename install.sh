#!/usr/bin/env bash
# Install the agent-ui-kit skill into a XiaoBa skills directory.
#
#   ./install.sh                       # → $XIAOBA_SKILLS_DIR, else ~/.xiaoba/skills
#   ./install.sh /path/to/skills       # → explicit destination
#
# Copies skills/agent-ui-kit/ as a directory. Re-running overwrites it, which is
# the point of an installer: whatever you changed in the installed copy is lost.
# Keep local changes in this repo and re-run, or the next install will silently
# undo them.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-${XIAOBA_SKILLS_DIR:-$HOME/.xiaoba/skills}}"
SKILL="agent-ui-kit"

if [ ! -f "$SRC/skills/$SKILL/SKILL.md" ]; then
  echo "error: $SRC/skills/$SKILL/SKILL.md not found" >&2
  exit 1
fi

mkdir -p "$DEST/$SKILL"
cp "$SRC/skills/$SKILL/SKILL.md" "$DEST/$SKILL/SKILL.md"

echo "installed $SKILL → $DEST/$SKILL"
echo "prototype (independent of the skill) is in $SRC/prototype"
