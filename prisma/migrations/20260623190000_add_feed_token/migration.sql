-- FR-F4 — token subskrypcji kanału iCal (webcal nie wysyła nagłówka Bearer)
ALTER TABLE "Employee" ADD COLUMN "feedToken" TEXT;
CREATE UNIQUE INDEX "Employee_feedToken_key" ON "Employee"("feedToken");
