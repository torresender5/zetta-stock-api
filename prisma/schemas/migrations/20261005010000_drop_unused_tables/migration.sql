-- Poda de modelos sin uso (Fase 4.2): Posts, Person y ProductType no se
-- consultan ni escriben en `src/` ni en `prisma/seed.ts`.
DROP TABLE "Person";

DROP TABLE "Posts";

DROP TABLE "ProductType";
