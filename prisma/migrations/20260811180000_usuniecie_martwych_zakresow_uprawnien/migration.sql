-- FR-H4 — z listy uprawnień rozszerzonych znikają dwie wartości, których nic nie czytało.
--
-- `PermissionScope` deklarował ADMIN i REPORTS, ale żadne miejsce w kodzie nie pytało o nie:
-- dostęp administratora i raportowy wynika z ROLI (dekorator @Roles oraz rbac.ts), a jedyne
-- uprawnienia, na których cokolwiek stoi, to MODIFY_ABSENCE i VIEW_L4. Ekran „Pracownicy"
-- także oferował wyłącznie te dwa.
--
-- Nadanie martwej wartości nie dawało niczego — samo w sobie bezpieczne, ale mylące dokładnie
-- wtedy, gdy pomyłka kosztuje najwięcej: administrator widzi w API zakres „ADMIN", nadaje go
-- w dobrej wierze i sądzi, że komuś czegoś udzielił. Gorsza była perspektywa: nazwa sugerująca
-- uprawnienie kusi, żeby kiedyś oprzeć na niej warunek, a wtedy wartość, którą dziś można
-- nadać byle komu bez skutku, z dnia na dzień staje się drogą do podniesienia uprawnień.
--
-- Wiersze z martwymi zakresami usuwamy, zamiast zatrzymywać migrację na błędzie rzutowania.
-- Nie odbiera to nikomu żadnego dostępu: te wpisy nie były nigdzie czytane, więc nic nie
-- znaczyły. Zapis mówi wprost, ile ich było — gdyby wdrożenie miało takie wiersze, zostaje
-- po tym ślad w logu migracji, a nie ciche zniknięcie.
DO $$
DECLARE usuniete INT;
BEGIN
  DELETE FROM "Permission" WHERE "scope"::text IN ('ADMIN', 'REPORTS');
  GET DIAGNOSTICS usuniete = ROW_COUNT;
  RAISE NOTICE 'Usunięto % nieczytanych wpisów uprawnień (ADMIN/REPORTS).', usuniete;
END $$;

-- PostgreSQL nie umie usunąć wartości z typu wyliczeniowego, więc typ powstaje na nowo,
-- a kolumna przechodzi na niego rzutowaniem przez tekst.
ALTER TYPE "PermissionScope" RENAME TO "PermissionScope_old";
CREATE TYPE "PermissionScope" AS ENUM ('MODIFY_ABSENCE', 'VIEW_L4');
ALTER TABLE "Permission" ALTER COLUMN "scope" TYPE "PermissionScope" USING ("scope"::text::"PermissionScope");
DROP TYPE "PermissionScope_old";
