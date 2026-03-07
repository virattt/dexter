#!/usr/bin/env bash
# Backup ~/.dexter to ~/.dexter-backups/dexter-YYYY-MM-DD-HHMMSS.tar.gz
# Includes: PORTFOLIO.md, PORTFOLIO-HYPERLIQUID.md, HEARTBEAT.md, fund-config.json, performance-history.json, scratchpad/
# Excludes: gateway.json (auth)

set -e

DEXTER_DIR="${HOME}/.dexter"
BACKUP_DIR="${HOME}/.dexter-backups"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
STAGING="${BACKUP_DIR}/dexter-${TIMESTAMP}"
ARCHIVE="${BACKUP_DIR}/dexter-${TIMESTAMP}.tar.gz"

if [[ ! -d "$DEXTER_DIR" ]]; then
  echo "[dexter] No ~/.dexter directory found. Nothing to backup."
  exit 0
fi

mkdir -p "$STAGING"

for f in PORTFOLIO.md PORTFOLIO-HYPERLIQUID.md HEARTBEAT.md fund-config.json performance-history.json; do
  [[ -f "${DEXTER_DIR}/${f}" ]] && cp "${DEXTER_DIR}/${f}" "${STAGING}/"
done

[[ -d "${DEXTER_DIR}/scratchpad" ]] && cp -r "${DEXTER_DIR}/scratchpad" "${STAGING}/" 2>/dev/null || true

tar --create --gzip --file="$ARCHIVE" -C "$BACKUP_DIR" "dexter-${TIMESTAMP}"
rm -rf "$STAGING"

echo "[dexter] Backup saved to ${ARCHIVE}"
