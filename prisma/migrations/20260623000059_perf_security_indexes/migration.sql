-- CreateIndex
CREATE INDEX "Absence_dateFrom_dateTo_idx" ON "Absence"("dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "OrgUnit_parentId_idx" ON "OrgUnit"("parentId");

-- CreateIndex
CREATE INDEX "OrgUnitMembership_orgUnitId_idx" ON "OrgUnitMembership"("orgUnitId");

-- CreateIndex
CREATE INDEX "Sprint_dateFrom_dateTo_idx" ON "Sprint"("dateFrom", "dateTo");
