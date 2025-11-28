# Supabase Schema Update

Please run the following SQL in your Supabase SQL Editor to update the database schema to match the application requirements.

```sql
-- Add 'type' column to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('HL', 'SL')) DEFAULT 'HL';

-- Add new columns to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS ib_grade integer CHECK (ib_grade >= 1 AND ib_grade <= 7),
ADD COLUMN IF NOT EXISTS raw_grade text,
ADD COLUMN IF NOT EXISTS raw_percent real;

-- Rename 'percentage' to 'raw_percent' if you want to migrate data, 
-- but since we are adding 'raw_percent', we can just drop 'percentage' if it's not needed,
-- or keep it for legacy. For now, we'll just ignore 'percentage' in the new code 
-- and use 'raw_percent'.

-- If you want to clean up the 'percentage' column later:
-- ALTER TABLE assignments DROP COLUMN percentage;
```
