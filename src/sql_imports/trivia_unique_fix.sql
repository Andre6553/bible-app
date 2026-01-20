-- Add unique constraint to avoid duplicate English questions
ALTER TABLE trivia_questions ADD CONSTRAINT unique_question_en UNIQUE (question_text_en);
