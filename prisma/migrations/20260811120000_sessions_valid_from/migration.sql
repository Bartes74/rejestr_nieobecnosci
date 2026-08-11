-- FR-J2 — anonimizacja i reset hasła mają kończyć trwające sesje, nie tylko blokować kolejne.
--
-- Token niesie wyłącznie tożsamość, a rolę, uprawnienia i datę zakończenia współpracy strażnik
-- czyta z bazy przy każdym żądaniu — więc odebranie uprawnienia albo usunięcie konta działa
-- natychmiast. Jedno zdarzenie przez tę siatkę przechodziło: anonimizacja zeruje dane osobowe
-- i hasło, ale ZOSTAWIA wiersz pracownika, bo na nim wiszą wpisy nieobecności. Strażnik taki
-- wiersz znajdował i wpuszczał dalej: zalogować się ponownie nie dało (brak hasła), ale token
-- wydany wcześniej działał jeszcze do dwunastu godzin. Na ścieżce RODO oznaczało to pół doby
-- czytania danych po realizacji prawa do bycia zapomnianym.
--
-- Data, nie licznik wersji: mówi wprost, OD KIEDY sesje są ważne, i porównuje się bezpośrednio
-- z `iat` w tokenie, którego i tak nie trzeba było zmieniać. `NULL` znaczy „nigdy nie
-- unieważniano" i jest przypadkiem domyślnym, więc kolumna nie zmienia zachowania nikomu,
-- kogo ta operacja nie dotyczyła.
ALTER TABLE "Employee" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);

-- Konta zanonimizowane przed tą migracją dostają znacznik z chwili anonimizacji. Dziennik
-- audytu zna ten moment (akcja ANONYMIZE, `subjectId` wskazuje osobę), więc nie ma powodu
-- zostawiać ich z sesjami ważnymi „od zawsze". Osoba anonimizowana wielokrotnie dostaje
-- znacznik z ostatniego razu — wcześniejsze i tak są nim objęte.
UPDATE "Employee" e
SET "sessionsValidFrom" = a.ts
FROM (
  SELECT "subjectId", max("timestamp") AS ts
  FROM "AuditLog"
  WHERE action = 'ANONYMIZE' AND "subjectId" IS NOT NULL
  GROUP BY "subjectId"
) a
WHERE e.id = a."subjectId";
