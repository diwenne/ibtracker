# Supabase Schema Update

Please run the following SQL in your Supabase SQL Editor to update the database schema to match the application requirements.

```sql
-- Add 'type' column to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS type text CHECK (type IN ('HL', 'SL')) DEFAULT 'HL';

-- Add prediction caching and dirty flag to subjects
ALTER TABLE subjects
ADD COLUMN IF NOT EXISTS ai_predicted_grade integer,
ADD COLUMN IF NOT EXISTS ai_explanation text,
ADD COLUMN IF NOT EXISTS prediction_dirty boolean DEFAULT true;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  raw_weight double precision NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Add new columns to assessments table
ALTER TABLE assessments
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS ib_grade integer CHECK (ib_grade >= 1 AND ib_grade <= 7),
ADD COLUMN IF NOT EXISTS raw_grade text,
ADD COLUMN IF NOT EXISTS raw_percent real,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Rename 'percentage' to 'raw_percent' if you want to migrate data,
-- but since we are adding 'raw_percent', we can just drop 'percentage' if it's not needed,
-- or keep it for legacy. For now, we'll just ignore 'percentage' in the new code
-- and use 'raw_percent'.

-- If you want to clean up the 'percentage' column later:
-- ALTER TABLE assessments DROP COLUMN percentage;
```
