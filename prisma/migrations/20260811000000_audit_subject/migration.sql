-- FR-I1 — dziennik ma odpowiadać nie tylko „kto", ale i „kogo dotyczy".
--
-- `entityId` wskazuje obiekt zdarzenia (nieobecność, pracownika, uprawnienie), więc dla wpisów
-- o nieobecności prowadzi do samej nieobecności. Po jej usunięciu — czyli w przypadku, o który
-- audytor pyta najczęściej — nie prowadzi już do nikogo. `subjectId` trzyma osobę wprost.
--
-- Identyfikator, nie nazwisko: nazwisko wpisane do dziennika przeżyłoby anonimizację (FR-J2),
-- a więc i żądanie usunięcia danych. Rozwija je odczyt, z tabeli pracowników.
ALTER TABLE "AuditLog" ADD COLUMN "subjectId" TEXT;

-- Wpisy o pracowniku i o uprawnieniu wskazywały osobę już wcześniej, tyle że w `entityId`.
UPDATE "AuditLog" SET "subjectId" = "entityId"
WHERE "entityId" IS NOT NULL AND "entity" IN ('Employee', 'Permission');

-- Wpisy o nieobecnościach, które nadal istnieją, dostają właściciela z tabeli nieobecności.
-- Dla usuniętych zostaje NULL — tej informacji nie ma już skąd wziąć i udawanie jej byłoby
-- gorsze niż puste pole.
UPDATE "AuditLog" a SET "subjectId" = ab."employeeId"
FROM "Absence" ab
WHERE a."entity" = 'Absence' AND a."entityId" = ab."id" AND a."subjectId" IS NULL;
