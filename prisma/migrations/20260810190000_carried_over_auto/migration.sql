-- FR-B7 — automatyczne rolowanie urlopu zaległego na przełomie okresu rozliczeniowego.
--
-- Dotąd `carriedOver` był liczbą wpisywaną ręcznie przez administratora, a brak wiersza dla
-- nowego okresu oznaczał zero zaległych dni. Efekt: 1 stycznia (UoP) i 1 grudnia (B2B/OUT)
-- saldo zaległych każdego pracownika spadało do zera, dopóki ktoś nie wprowadził go ręcznie.
-- Kolumna staje się opcjonalna: NULL = wylicz z łańcucha poprzednich okresów, liczba = korekta
-- administratora (wygrywa nad wyliczeniem).
ALTER TABLE "LeaveAllowance" ALTER COLUMN "carriedOver" DROP DEFAULT;
ALTER TABLE "LeaveAllowance" ALTER COLUMN "carriedOver" DROP NOT NULL;

-- Istniejące zera pochodzą z domyślnej wartości kolumny, nie z decyzji administratora —
-- zostawienie ich jako „korekta = 0" zablokowałoby rolowanie dokładnie tam, gdzie ma zadziałać.
-- Wartości niezerowe to świadome wpisy i zostają.
UPDATE "LeaveAllowance" SET "carriedOver" = NULL WHERE "carriedOver" = 0;
