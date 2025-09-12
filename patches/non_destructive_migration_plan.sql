-- Non-destructive migration plan for adding IDENTITY to existing INT PRIMARY KEY columns
-- This file is a plan and must be applied manually after review and backups.
-- Steps (example for Products.ProductId):

-- 1) Add a new identity column
ALTER TABLE dbo.Products ADD NewProductId INT IDENTITY(1,1) NULL;

-- 2) Backfill references (application-specific) OR create mapping table
-- TODO: Backfill existing FK references in child tables to point to NewProductId values.

-- 3) Update application to write to NewProductId (or use trigger to keep both in sync)
-- 4) Once validated, drop old PK and rename NewProductId -> ProductId (manual step, data-sensitive)
-- 5) Recreate FK constraints to reference the new PK names

-- IMPORTANT: This is a manual and potentially destructive sequence if done incorrectly. Always test on a staging environment, take backups and coordinate downtime.

-- Example: create mapping table to map oldId -> newId
-- CREATE TABLE dbo.ProductIdMap (OldProductId INT PRIMARY KEY, NewProductId INT UNIQUE);

-- Batch backfill example (conceptual)
-- INSERT INTO dbo.ProductIdMap (OldProductId, NewProductId)
-- SELECT ProductId, NewProductId FROM dbo.Products;

-- After backfill, you can switch foreign keys in child tables by updating them to the new IDs in a transactional and monitored process.
