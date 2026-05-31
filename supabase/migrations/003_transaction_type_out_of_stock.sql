-- ============================================================
-- Add out_of_stock to the transaction_type check constraint
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
  CHECK (transaction_type IN ('sale','restock','transfer','adjustment','count','out_of_stock'));
