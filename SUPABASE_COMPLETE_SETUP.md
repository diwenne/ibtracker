# Complete Supabase Setup

Since your project is blank, please run this **entire** SQL block in the Supabase SQL Editor. This will create all the necessary tables with the correct columns.

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Subjects table
create table subjects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text CHECK (type IN ('HL', 'SL')) DEFAULT 'HL',
  target_grade integer not null check (target_grade >= 1 and target_grade <= 7),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

-- Assessments table
create table assessments (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text,
  ib_grade integer CHECK (ib_grade >= 1 AND ib_grade <= 7),
  raw_grade text,
  raw_percent real,
  date text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table subjects enable row level security;
alter table assessments enable row level security;

-- RLS Policies for subjects table
create policy "Users can view their own subjects"
  on subjects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subjects"
  on subjects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own subjects"
  on subjects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own subjects"
  on subjects for delete
  using (auth.uid() = user_id);

-- RLS Policies for assessments table
create policy "Users can view their own assessments"
  on assessments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own assessments"
  on assessments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own assessments"
  on assessments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own assessments"
  on assessments for delete
  using (auth.uid() = user_id);

-- Indexes for better performance
create index subjects_user_id_idx on subjects(user_id);
create index assessments_user_id_idx on assessments(user_id);
create index assessments_subject_id_idx on assessments(subject_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at
create trigger update_subjects_updated_at
  before update on subjects
  for each row
  execute procedure update_updated_at_column();

create trigger update_assessments_updated_at
  before update on assessments
  for each row
  execute procedure update_updated_at_column();
```
