# Supabase Setup Instructions for IB Tracker

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click "New Project"
3. Fill in the project details:
   - **Name**: `ib-tracker` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the region closest to you
4. Click "Create new project" and wait for it to initialize (~2 minutes)

## Step 2: Set Up Database Tables

1. In your Supabase project dashboard, go to the **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy and paste the following SQL schema:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Subjects table
create table subjects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('HL', 'SL')),
  target_grade integer not null check (target_grade >= 1 and target_grade <= 7),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, name)
);

-- Assignments table
create table assignments (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  ib_grade integer not null check (ib_grade >= 1 and ib_grade <= 7),
  raw_grade text,
  raw_percent real,
  date text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table subjects enable row level security;
alter table assignments enable row level security;

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

-- RLS Policies for assignments table
create policy "Users can view their own assignments"
  on assignments for select
  using (auth.uid() = user_id);

create policy "Users can insert their own assignments"
  on assignments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own assignments"
  on assignments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own assignments"
  on assignments for delete
  using (auth.uid() = user_id);

-- Indexes for better performance
create index subjects_user_id_idx on subjects(user_id);
create index assignments_user_id_idx on assignments(user_id);
create index assignments_subject_id_idx on assignments(subject_id);

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

create trigger update_assignments_updated_at
  before update on assignments
  for each row
  execute procedure update_updated_at_column();
```

4. Click "Run" to execute the SQL
5. You should see "Success. No rows returned" if everything worked correctly

## Step 3: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Ensure **Email** provider is enabled (it should be by default)
3. Go to **Authentication** → **URL Configuration**
4. Add your site URL (for local development: `http://localhost:3000`)
5. Add redirect URLs:
   - `http://localhost:3000/auth/callback` (for local development)
   - Add your production URL when deploying
6. Configure email settings or use Supabase's default email service for development

## Step 4: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. You'll need two values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (a long string starting with "eyJ")
3. Keep these handy for the next step

## Step 5: Set Up Environment Variables

1. In your project root (`/Users/diwenhuang/ib-grade-tracker/`), create a file named `.env.local`
2. Add the following (replace with your actual values):

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Make sure `.env.local` is in your `.gitignore` file (Next.js adds this by default)

## Step 6: Install Dependencies

Run this command in your terminal:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Next Steps

After completing these setup steps, the application code will be updated to:
- Create a Supabase client utility
- Add authentication components (login/signup)
- Replace localStorage with Supabase database calls
- Sync all subjects and assignments to the cloud

Your data will be securely stored and accessible from any device after logging in!
