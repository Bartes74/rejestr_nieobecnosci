#!/usr/bin/env bash
# Backup bazy „Nieobecności" (NFR-4). Uruchamiać codziennie z crona, np.:
#   0 2 * * *  /sciezka/scripts/backup.sh /var/backups/nieobecnosci
# RPO: <= odstęp między backupami (przy dziennym ~24h; skróć harmonogram, jeśli trzeba mniej).
# RTO: czas odtworzenia z dumpu (gunzip | psql). Test odtworzenia rób okresowo na osobnej bazie.
set -euo pipefail

DIR="${1:-./backups}"
mkdir -p "$DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/nieobecnosci-$TS.sql.gz"

docker compose exec -T db pg_dump -U nieobecnosci nieobecnosci | gzip > "$OUT"
echo "Backup: $OUT ($(du -h "$OUT" | cut -f1))"

# Retencja: usuń backupy starsze niż 30 dni.
find "$DIR" -name 'nieobecnosci-*.sql.gz' -mtime +30 -delete 2>/dev/null || true

# Odtworzenie:  gunzip -c BACKUP.sql.gz | docker compose exec -T db psql -U nieobecnosci nieobecnosci
