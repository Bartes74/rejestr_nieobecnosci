-- FR-I1 / NFR-5 — dziennik audytu naprawdę niemodyfikowalny.
--
-- Schemat opisuje AuditLog jako append-only, ale to była wyłącznie konwencja w kodzie:
-- aplikacja łączyła się jako właściciel schematu, więc `DELETE FROM "AuditLog"` przechodziło
-- bez przeszkód. Dziennik, który da się wyczyścić tym samym poświadczeniem, którym aplikacja
-- pisze na co dzień, nie jest dowodem dla audytora — jest notatką.
--
-- Rozdzielenie ról: właściciel (`nieobecnosci`) wykonuje migracje, aplikacja (`nieobecnosci_app`)
-- pracuje bez prawa modyfikowania i kasowania wpisów dziennika. Aplikacja NIE może sama sobie
-- tego prawa przywrócić, bo nie jest właścicielem tabeli — na tym polega cała różnica.
--
-- Uruchomić RAZ, jako właściciel bazy, PO pierwszym `prisma migrate deploy`:
--   docker compose -f docker-compose.prod.yml exec -T db \
--     psql -U nieobecnosci -d nieobecnosci -v haslo="'TU_HASLO_APLIKACJI'" < scripts/db-appuser.sql
--
-- Hasło wchodzi parametrem `-v haslo`, żeby nie leżało w repozytorium. To samo hasło musi
-- znaleźć się w DATABASE_URL w .env.prod (patrz .env.prod.example).

\set ON_ERROR_STOP on

-- Rola aplikacji. Ponowne uruchomienie skryptu ma tylko odświeżyć hasło i uprawnienia,
-- a nie wywrócić się na tym, że rola już istnieje.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nieobecnosci_app') THEN
    CREATE ROLE nieobecnosci_app LOGIN;
  END IF;
END
$$;
ALTER ROLE nieobecnosci_app WITH PASSWORD :haslo;

GRANT CONNECT ON DATABASE nieobecnosci TO nieobecnosci_app;
GRANT USAGE ON SCHEMA public TO nieobecnosci_app;

-- Pełne prawa do danych na tabelach istniejących…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nieobecnosci_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nieobecnosci_app;

-- …i na tych, które dołożą przyszłe migracje. Bez tego każda nowa tabela wymagałaby ręcznego
-- GRANT-a, a zapomniany krok objawiłby się dopiero błędem uprawnień na produkcji.
ALTER DEFAULT PRIVILEGES FOR ROLE nieobecnosci IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nieobecnosci_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nieobecnosci IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nieobecnosci_app;

-- Wyjątek, o który w tym wszystkim chodzi: do dziennika wolno wyłącznie dopisywać i czytać.
REVOKE UPDATE, DELETE ON "AuditLog" FROM nieobecnosci_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nieobecnosci IN SCHEMA public
  REVOKE UPDATE, DELETE ON TABLES FROM nieobecnosci_app;
-- Powyższy REVOKE domyślnych praw obejmuje wszystkie przyszłe tabele, więc oddajemy je z powrotem
-- wszystkim poza dziennikiem. Prisma nie tworzy tabel w trakcie pracy aplikacji, więc listę
-- odświeża się przy wdrożeniu migracji — patrz README, sekcja wdrożeniowa.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'AuditLog'
  LOOP
    EXECUTE format('GRANT UPDATE, DELETE ON %I TO nieobecnosci_app', t);
  END LOOP;
END
$$;

-- Kontrola: aplikacja ma pisać do dziennika, ale nie kasować.
DO $$
BEGIN
  IF has_table_privilege('nieobecnosci_app', '"AuditLog"', 'DELETE')
     OR has_table_privilege('nieobecnosci_app', '"AuditLog"', 'UPDATE') THEN
    RAISE EXCEPTION 'Rola aplikacji nadal może modyfikować dziennik audytu — skrypt nie zadziałał.';
  END IF;
  IF NOT has_table_privilege('nieobecnosci_app', '"AuditLog"', 'INSERT')
     OR NOT has_table_privilege('nieobecnosci_app', '"AuditLog"', 'SELECT') THEN
    RAISE EXCEPTION 'Rola aplikacji nie może pisać do dziennika — aplikacja nie wystartuje.';
  END IF;
  RAISE NOTICE 'Dziennik audytu: zapis i odczyt tak, modyfikacja i kasowanie nie.';
END
$$;
