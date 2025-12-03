# Teacher Feature

## Overview
Added support for assigning a teacher to each subject. This allows for teacher-specific grading algorithms to be applied in future updates.

## Database Changes
- Added `teacher` column to `subjects` table (nullable TEXT field)
- Migration file: `supabase-teacher-migration.sql`

### Available Teachers
- **General Algorithm** (null in database) - Default mathematical grading
- **Greenwood** (PMSS; Physics) - Physics teacher at PMSS

## Implementation Details

### Database Schema
```sql
ALTER TABLE subjects
ADD COLUMN teacher TEXT;
```

### Type Updates
- Updated `src/types/database.ts` - Added `teacher: string | null` to Subject type
- Updated `src/lib/types.ts` - Added `teacher?: string | null` to Subject interface

### API Changes
- **fetchSubjects**: Now returns the `teacher` field
- **updateSubject**: Now accepts optional `teacher` parameter and updates it in the database

### UI Changes
- **EditSubjectDialog**: Added teacher input field
  - Optional text input
  - Placeholder: "Leave blank for general algorithm"
  - Helper text: "Set a teacher for subject-specific grade prediction"
  - Can be left empty to use general algorithm
  - Can be cleared by leaving field empty

## Usage

### Setting a Teacher
1. Click on a subject card to open details
2. Click the edit (pencil) icon next to the subject name
3. In the "Teacher (Optional)" field, enter the teacher's name
4. Click "Save Changes"

### Removing a Teacher
1. Follow the same steps as setting a teacher
2. Clear the teacher field completely
3. Click "Save Changes"
4. The subject will revert to using the general grading algorithm

## Future Implementation Notes

When implementing teacher-specific algorithms:

1. Check if `subject.teacher` is set
2. If set, apply teacher-specific logic in `/api/predict-grade/route.ts`
3. Different teachers may have different:
   - Grade boundaries
   - Assessment weighting preferences
   - Rounding rules
   - Leniency/strictness factors

Example structure for teacher-specific logic:
```typescript
if (subject.teacher) {
  switch (subject.teacher.toLowerCase()) {
    case 'teacher1':
      // Apply teacher1-specific algorithm
      break;
    case 'teacher2':
      // Apply teacher2-specific algorithm
      break;
    default:
      // Apply general algorithm
  }
} else {
  // Apply general algorithm
}
```

## Database Migration

Run the SQL migration to add the teacher column:
```bash
# Connect to your Supabase project and run:
psql -f supabase-teacher-migration.sql
```

Or run it directly in the Supabase SQL editor.
