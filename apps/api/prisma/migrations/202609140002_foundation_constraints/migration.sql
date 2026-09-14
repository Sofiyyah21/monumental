ALTER TABLE "Product"
  ADD CONSTRAINT "Product_costPrice_nonnegative" CHECK ("costPrice" >= 0),
  ADD CONSTRAINT "Product_sellingPrice_positive" CHECK ("sellingPrice" > 0),
  ADD CONSTRAINT "Product_currentStock_nonnegative" CHECK ("currentStock" >= 0),
  ADD CONSTRAINT "Product_lowStockThreshold_nonnegative" CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "Product_unit_matches_category" CHECK (
    ("category" IN ('DRINK', 'NOODLES') AND "unit" = 'PACK')
    OR ("category" = 'VEGETABLE_OIL' AND "unit" = 'LITER')
    OR ("category" = 'SUGAR' AND "unit" = 'CUP')
  );

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_totalAmount_nonnegative" CHECK ("totalAmount" >= 0),
  ADD CONSTRAINT "Sale_totalCost_nonnegative" CHECK ("totalCost" >= 0);

ALTER TABLE "SaleItem"
  ADD CONSTRAINT "SaleItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "SaleItem_unitPrice_positive" CHECK ("unitPrice" > 0),
  ADD CONSTRAINT "SaleItem_unitCost_nonnegative" CHECK ("unitCost" >= 0),
  ADD CONSTRAINT "SaleItem_lineTotal_nonnegative" CHECK ("lineTotal" >= 0),
  ADD CONSTRAINT "SaleItem_lineCost_nonnegative" CHECK ("lineCost" >= 0);

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_nonnegative" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "StockMovement_previousStock_nonnegative" CHECK ("previousStock" >= 0),
  ADD CONSTRAINT "StockMovement_newStock_nonnegative" CHECK ("newStock" >= 0),
  ADD CONSTRAINT "StockMovement_unitCost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
