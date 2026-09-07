-- Lider jednostki organizacyjnej (feedback002, widok dyrektora).
--
-- Dyrektor chce śledzić nakładające się nieobecności ~6 liderów Tribe'ów i planować zastępstwa,
-- a model nie znał pojęcia „lider jednostki": rola konta LEADER jest globalna i nie mówi, czyim
-- liderem ktoś jest, a flaga isKeyRole znaczy „osoba kluczowa dla capacity", nie „lider".
--
-- Kolumna jest opcjonalna, więc migracja jest addytywna i bezpieczna dla istniejących danych.
-- ON DELETE SET NULL: usunięcie pracownika czyści wskazanie, nie blokuje usunięcia.
-- AlterTable
ALTER TABLE "OrgUnit" ADD COLUMN     "leaderId" TEXT;

-- CreateIndex
CREATE INDEX "OrgUnit_leaderId_idx" ON "OrgUnit"("leaderId");

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
