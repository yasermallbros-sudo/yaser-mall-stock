ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mainCategory" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "subCategory" TEXT;
CREATE INDEX IF NOT EXISTS "Product_mainCategory_idx" ON "Product"("mainCategory");
CREATE INDEX IF NOT EXISTS "Product_subCategory_idx" ON "Product"("subCategory");
