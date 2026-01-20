-- Trivia Questions Table
create table if not exists trivia_questions (
  id uuid default gen_random_uuid() primary key,
  question_text_en text not null,
  question_text_af text not null,
  options_en jsonb not null, -- Array of 3 strings
  options_af jsonb not null, -- Array of 3 strings
  correct_index int not null check (correct_index between 0 and 2),
  verse_ref_en text,
  verse_ref_af text,
  testament text not null check (testament in ('OT', 'NT')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Trivia History (Tracks answered questions to prevent 360-day repeats)
create table if not exists user_trivia_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null, -- Assuming auth.users or user_profiles depending on FK needs. Usually auth.users.
  question_id uuid references trivia_questions(id) on delete cascade not null,
  is_correct boolean not null,
  answered_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_user_trivia_history_user_question on user_trivia_history(user_id, question_id);
create index if not exists idx_user_trivia_history_answered_at on user_trivia_history(answered_at);

-- User Trivia Daily Counters
create table if not exists user_trivia_daily (
  user_id uuid references auth.users(id) on delete cascade not null,
  date date default current_date not null,
  count int default 0 not null,
  primary key (user_id, date)
);

-- RLS Policies
alter table trivia_questions enable row level security;
alter table user_trivia_history enable row level security;
alter table user_trivia_daily enable row level security;

-- Questions are readable by everyone (authenticated)
create policy "Allow read access to questions for authenticated users"
  on trivia_questions for select
  to authenticated
  using (true);

-- History is readable/writable by the user only
create policy "Users can view own history"
  on user_trivia_history for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own history"
  on user_trivia_history for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Daily counters
create policy "Users can view own daily stats"
  on user_trivia_daily for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own daily stats"
  on user_trivia_daily for all -- insert/update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
