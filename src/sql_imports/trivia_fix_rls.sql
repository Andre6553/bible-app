-- Fix: Allow authenticated users to insert generic AI questions
create policy "Allow authenticated users to insert questions"
  on trivia_questions for insert
  to authenticated
  with check (true);
