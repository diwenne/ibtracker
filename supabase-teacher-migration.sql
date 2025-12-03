-- Add teacher column to subjects table
ALTER TABLE subjects
ADD COLUMN teacher TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN subjects.teacher IS 'Optional teacher name for subject-specific grading algorithms';
