#!/bin/sh
set -e

mkdir -p "${UPLOADS_DIR:-/data/uploads}"
case "${DATABASE_URL:-}" in
  file:*) mkdir -p "$(dirname "$(printf '%s' "${DATABASE_URL#file:}")")" ;;
esac

pnpm db:bootstrap
exec node dist/src/main.js
