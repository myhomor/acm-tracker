#!/bin/sh
# Сохраняет локальные правки исходников трекера (acm-tracker/) в patches/acm-tracker.patch
# относительно базового коммита upstream. Индекс самого acm-tracker не трогает.
set -eu
cd "$(dirname "$0")/.."
BASE=0e95c8a
INDEX=$(mktemp)
trap 'rm -f "$INDEX"' EXIT
GIT_INDEX_FILE="$INDEX" git -C acm-tracker read-tree "$BASE"
GIT_INDEX_FILE="$INDEX" git -C acm-tracker -c core.safecrlf=false add -A
GIT_INDEX_FILE="$INDEX" git -C acm-tracker diff --cached --binary "$BASE" > patches/acm-tracker.patch
echo "patches/acm-tracker.patch: $(grep -c '^diff --git' patches/acm-tracker.patch) files changed against $BASE"
