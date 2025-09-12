-- SQL validation tests for fixed_schema.sql
-- 1) Test IDENTITY inserted: insert into Orders without OrderId
SET NOCOUNT ON;
USE [EXPORTED_DB_20250912_000000];

-- Insert customer
INSERT INTO dbo.Customers (FirstName, LastName, Email) VALUES ('John','Doe','john@example.com');

-- Insert order referencing customer
INSERT INTO dbo.Orders (CustomerId) VALUES (1);

-- Insert order item and expect LineTotal computed
INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice) VALUES (1, 1, 2, 9.99);

-- Check Orders.TotalAmount reflects the OrderItems sum (should be 19.98)
SELECT TotalAmount FROM dbo.Orders WHERE OrderId = 1;
