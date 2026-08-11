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

# Zapis idzie do pliku tymczasowego, a nazwę docelową dostaje dopiero po udanym dumpie.
# Przekierowanie wprost do "$OUT" tworzyło plik ZANIM wiadomo było, czy pg_dump się powiódł —
# przerwany dump zostawiał obcięte archiwum wyglądające jak backup, a `set -e` kończyło skrypt
# przed retencją. Kolejne uruchomienia usuwały z czasem dobre kopie, zostawiając tę wadliwą.
docker compose exec -T db pg_dump -U nieobecnosci nieobecnosci | gzip > "$OUT.tmp"
# Sam kod wyjścia nie wystarcza: `gzip` kończy się powodzeniem także wtedy, gdy dostał zero
# bajtów. Pusty plik gz ma 20 bajtów, więc próg odsiewa dump, który nie zawiera niczego.
if [ ! -s "$OUT.tmp" ] || [ "$(wc -c < "$OUT.tmp")" -lt 100 ]; then
	rm -f "$OUT.tmp"
	echo "Backup NIEUDANY: dump jest pusty. Nic nie zapisano." >&2
	exit 1
fi
mv "$OUT.tmp" "$OUT"
echo "Backup: $OUT ($(du -h "$OUT" | cut -f1))"

# Retencja: usuń backupy starsze niż 30 dni.
find "$DIR" -name 'nieobecnosci-*.sql.gz' -mtime +30 -delete 2>/dev/null || true

# Odtworzenie:  gunzip -c BACKUP.sql.gz | docker compose exec -T db psql -U nieobecnosci nieobecnosci
