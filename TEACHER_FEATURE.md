# Teacher Feature

## Overview
Added support for assigning a teacher to each subject. Teachers have custom grading algorithms that replace the default AI/mathematical calculations.

## Database Changes
- Added `teacher` column to `subjects` table (nullable TEXT field)
- Migration file: `supabase-teacher-migration.sql`

### Available Teachers
- **General Algorithm** (null in database) - Default mathematical grading with AI assistance
- **Greenwood** (PMSS; Physics) - Physics teacher at PMSS with custom calculation algorithm

## Implementation Details

### Database Schema
```sql
ALTER TABLE subjects
ADD COLUMN teacher TEXT;
```

### Teacher Configuration (`src/lib/teachers.ts`)
Central configuration file for all teachers with:
- **TeacherConfig interface**: Defines teacher structure
  - `id`: Unique identifier
  - `displayName`: Display name for UI
  - `categories`: Teacher-specific assessment categories with weights
  - `note`: Special instructions for the teacher
  - `calculateGrade`: Optional custom calculation function
- **TEACHERS object**: Contains all teacher configurations
- **Helper functions**: `getTeacherConfig()`, `isValidTeacher()`, `getAllTeachers()`

### Type Updates
- Updated `src/types/database.ts` - Added `teacher: string | null` to Subject type
- Updated `src/lib/types.ts` - Added `teacher?: string | null` to Subject interface

### API Changes
- **fetchSubjects**: Now returns the `teacher` field
- **updateSubject**: Now accepts optional `teacher` parameter and updates it in the database
  - Deletes all existing categories when switching to teacher-specific grading
  - Creates teacher-specific categories
  - Clears category assignments from assessments

### UI Changes
- **Subject Details Dialog**: Added teacher selector (dropdown)
  - Positioned inline with Categories and Add Grade buttons
  - Compact width for mobile responsiveness
  - Shows confirmation dialog when switching to teacher-specific grading
  - Displays teacher note below dialog header
  - Shows "TEACHER" badge when using teacher calculation
  - Displays teacher-calculated grade, adjusted percentage, and explanation

- **ManageCategoriesDialog**: Made read-only for teacher-specific grading
  - Shows "View Categories" instead of "Manage Categories"
  - Hides edit, delete, and add functionality
  - Categories cannot be modified when teacher is selected

- **EditSubjectDialog**: Added teacher selector
  - Select dropdown with "General Algorithm" and all teachers
  - Can be changed to switch between grading methods

## Usage

### Setting a Teacher
**Method 1: From Subject Details Dialog**
1. Click on a subject card to open details
2. Use the teacher dropdown selector (next to Categories button)
3. Select a teacher from the list
4. Confirm the change (will delete existing categories and create teacher-specific ones)

**Method 2: From Edit Subject Dialog**
1. Click the edit (pencil) icon next to the subject name
2. Select a teacher from the dropdown
3. Click "Save Changes"

### Removing a Teacher
1. Open the subject details or edit dialog
2. Select "General Algorithm" from the teacher dropdown
3. The subject will revert to using the default grading algorithm

### How Teacher Grading Works
When a teacher is selected:
1. **Categories are locked**: Teacher-specific categories are created and cannot be edited
2. **Assessments require categories**: You must assign assessments to categories (Tests, Labs, etc.)
3. **Custom calculation**: The teacher's algorithm calculates grades based on raw grades (e.g., 31/35)
4. **No AI predictions**: AI predictions are disabled for teacher-specific subjects

## Greenwood Teacher Algorithm

### Categories
- **Tests**: 80% weight
- **Labs**: 18% weight
- **Note**: 2% is discarded (0.8 + 0.18 = 0.98)

### Calculation Method
1. **Accumulate Raw Grades by Category**:
   - Tests: Sum all test raw grades (e.g., 31/35 + 10/20 = 41/55)
   - Labs: Sum all lab raw grades (e.g., 18/20 + 15/15 = 33/35)

2. **Calculate Raw Percentages**:
   - Tests Raw %: (41/55) × 100 = 74.5%
   - Labs Raw %: (33/35) × 100 = 94.3%

3. **Apply Weighted Calculation**:
   - Raw %: (74.5% × 0.8) + (94.3% × 0.18) = 76.6%

4. **Map to IB Grade with Scaled Adjusted Percentage**:
   The adjusted percentage scales within each grade boundary:
   - **Grade 7** (80%+ raw): 98-100% adjusted (scales with raw percentage)
   - **Grade 6** (73-79% raw): 96-98% adjusted
   - **Grade 5** (60-72% raw): 90-96% adjusted
   - **Grade 4** (50-59% raw): 86-90% adjusted
   - **Grade 3** (40-49% raw): 76-86% adjusted
   - **Grade 2** (30-39% raw): 50-76% adjusted
   - **Grade 1** (<30% raw): <50% adjusted (scaled up to max 49%)

   Example:
   - 80% raw → 98.0% adjusted
   - 85% raw → 98.5% adjusted
   - 90% raw → 99.0% adjusted
   - 76.6% raw → 97.0% adjusted

5. **Display**:
   - IB Grade: 6
   - Percentage: 97.0% (scaled from 76.6% raw)
   - Explanation: "Tests: 41/55 = 74.5% • Labs: 33/35 = 94.3% • Weighted: (74.5% × 0.8) + (94.3% × 0.18) = 76.6% • Grade 6 (Adjusted: 97.0%)"

### Notes
- Only raw grade (e.g., 31/33) is required
- Other fields (raw percent, IB grade) are not used in the calculation
- Assessments must be assigned to the correct category (Tests or Labs)

## Adding New Teachers

To add a new teacher:

1. **Add to `src/lib/teachers.ts`**:
```typescript
export const TEACHERS: Record<string, TeacherConfig> = {
  Greenwood: { /* existing config */ },

  NewTeacher: {
    id: 'NewTeacher',
    displayName: 'New Teacher (School; Subject)',
    categories: [
      { name: 'Category1', weight: 0.6 },
      { name: 'Category2', weight: 0.4 }
    ],
    note: 'Special instructions for this teacher...',
    calculateGrade: calculateNewTeacherGrade  // Optional custom function
  }
};

// Optional: Add custom calculation function
function calculateNewTeacherGrade(subject: Subject, assessments: Assessment[]): GradeCalculationResult | null {
  // Implement custom logic
  return {
    grade: 7,
    percentage: 98,
    explanation: 'Detailed calculation explanation...'
  };
}
```

2. **The teacher will automatically appear in all teacher dropdowns**
3. **Users can select the new teacher for their subjects**

## Database Migration

Run the SQL migration to add the teacher column:
```bash
# Connect to your Supabase project and run:
psql -f supabase-teacher-migration.sql
```

Or run it directly in the Supabase SQL editor.
