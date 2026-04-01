-- Migration to add manual overrides and bonus points support (TOK/EE)

-- Add manual_percent and is_core to subjects
alter table subjects add column manual_percent real;
alter table subjects add column is_core boolean default false;
alter table subjects add column subject_group text; -- 'group1'-'group6', 'tok', 'ee'

-- Update subjects check constraint for type if needed, or just handle in app
-- Currently type is check (type in ('HL', 'SL')). TOK/EE don't really have HL/SL.
-- I'll allow 'CORE' as a type.
alter table subjects drop constraint subjects_type_check;
alter table subjects add constraint subjects_type_check check (type in ('HL', 'SL', 'CORE'));

-- Add letter_grade to assessments for TOK/EE
alter table assessments add column letter_grade text check (letter_grade in ('A', 'B', 'C', 'D', 'E', 'N'));
-- Make ib_grade optional in check constraint if it exists? 
-- The original check was: ib_grade integer not null check (ib_grade >= 1 and ib_grade <= 7)
-- We need to make it nullable or change the check.
alter table assessments alter column ib_grade drop not null;

-- User Settings table for global preferences
create table if not exists user_settings (
  user_id uuid references auth.users(id) on delete cascade primary key,
  include_bonus boolean default false,
  total_score_override integer,
  total_percent_override real,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for user_settings
alter table user_settings enable row level security;

-- RLS Policies for user_settings
do $$ 
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view their own settings') then
    create policy "Users can view their own settings" on user_settings for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can insert their own settings') then
    create policy "Users can insert their own settings" on user_settings for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Users can update their own settings') then
    create policy "Users can update their own settings" on user_settings for update using (auth.uid() = user_id);
  end if;
end $$;

-- Trigger for user_settings updated_at
create trigger update_user_settings_updated_at
  before update on user_settings
  for each row
  execute procedure update_updated_at_column();
