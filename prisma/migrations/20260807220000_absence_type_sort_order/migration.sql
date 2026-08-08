-- Kolejność typów nieobecności ustawiana przez administratora (FR-G1).
ALTER TABLE "AbsenceType" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Kolejność startowa dla istniejących wdrożeń. Bez tego wszystkie typy mają sortOrder = 0,
-- lista spada na sortowanie po nazwie i „L4" nadal wypada pierwsze — czyli dokładnie stan,
-- który ta zmiana usuwa. Typy zwykłe idą przed kategorią szczególną, w obu grupach alfabetycznie;
-- administrator może to dowolnie przestawić.
UPDATE "AbsenceType" AS t
SET "sortOrder" = s.rn
FROM (
  SELECT "id", (row_number() OVER (ORDER BY "specialCategory" ASC, "name" ASC))::int AS rn
  FROM "AbsenceType"
) AS s
WHERE t."id" = s."id";

CREATE INDEX "AbsenceType_sortOrder_name_idx" ON "AbsenceType"("sortOrder", "name");
