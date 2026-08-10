#!/usr/bin/env bash
# Test odtworzenia backupu (NFR-4). Backup, którego nikt nie odtworzył, ma nieznaną wartość:
# `pg_dump` kończy się sukcesem także wtedy, gdy plik da się później wczytać tylko częściowo.
#
#   scripts/restore-test.sh [KATALOG_BACKUPÓW]     # domyślnie ./backups
#
# Bierze NAJNOWSZY dump z katalogu, odtwarza go do bazy tymczasowej obok produkcyjnej,
# liczy wiersze w dwóch tabelach niosących właściwą treść i sprząta po sobie.
# Baza produkcyjna nie jest w żadnym momencie dotykana.
#
# Uruchamiać kwartalnie, zgodnie z zaleceniem w scripts/nieobecnosci-backup.timer.
# ponytail: sprawdza, że dump się wczytuje i ma dane — nie porównuje wiersz po wierszu
#           z produkcją. Gdyby kiedyś doszło do cichego gubienia danych, dołożyć porównanie sum.
set -euo pipefail

DIR="${1:-./backups}"
DB_USER="${DB_USER:-nieobecnosci}"
TMP_DB="restore_test_$$"

LATEST="$(ls -1t "$DIR"/nieobecnosci-*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$LATEST" ]; then
  echo "BRAK BACKUPU do sprawdzenia w $DIR — uruchom najpierw scripts/backup.sh" >&2
  exit 1
fi
echo "Dump:  $LATEST ($(du -h "$LATEST" | cut -f1), z $(date -r "$LATEST" '+%Y-%m-%d %H:%M'))"

psql() { docker compose exec -T db psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"; }
# Sprzątanie także po przerwanym przebiegu — inaczej kolejny test wywala się na istniejącej bazie.
cleanup() { psql -d postgres -c "DROP DATABASE IF EXISTS $TMP_DB;" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -d postgres -c "CREATE DATABASE $TMP_DB;" >/dev/null
gunzip -c "$LATEST" | docker compose exec -T db psql -U "$DB_USER" -v ON_ERROR_STOP=1 -q "$TMP_DB" >/dev/null

EMP="$(psql -d "$TMP_DB" -tAc 'SELECT count(*) FROM "Employee";')"
ABS="$(psql -d "$TMP_DB" -tAc 'SELECT count(*) FROM "Absence";')"
echo "Odtworzono: Employee=$EMP, Absence=$ABS"

# Zero pracowników znaczy, że dump wczytał się bez błędu, ale jest pusty — czyli backup istnieje
# i nie chroni niczego. To gorszy przypadek niż jawny błąd wczytania, bo nie rzuca się w oczy.
if [ "$EMP" -eq 0 ]; then
  echo "TEST ODTWORZENIA NIEUDANY — dump wczytany, ale nie zawiera pracowników." >&2
  exit 1
fi
echo "TEST ODTWORZENIA OK ✅  (RTO: czas tego przebiegu; RPO: wiek dumpu powyżej)"
