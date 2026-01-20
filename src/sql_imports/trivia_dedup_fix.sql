-- Delete duplicate questions, keeping the oldest one
DELETE FROM trivia_questions a USING trivia_questions b
WHERE a.id > b.id
AND a.question_text_en = b.question_text_en;

-- Now add constraint
ALTER TABLE trivia_questions ADD CONSTRAINT unique_question_en UNIQUE (question_text_en);
