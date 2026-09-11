ALTER TABLE funds
  ADD COLUMN IF NOT EXISTS holding_type text NOT NULL DEFAULT 'fund';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS holding_type text NOT NULL DEFAULT 'fund';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS internal_transfer_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'funds_holding_type_check'
  ) THEN
    ALTER TABLE funds ADD CONSTRAINT funds_holding_type_check
      CHECK (holding_type IN ('stock', 'fund'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_holding_type_check'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_holding_type_check
      CHECK (holding_type IN ('stock', 'fund'));
  END IF;
END $$;
