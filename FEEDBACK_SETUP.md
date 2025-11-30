# Feedback Feature Setup

## Database Setup

To enable the feedback feature, you need to create the `feedback` table in your Supabase database.

### Steps:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL migration in `supabase-feedback-migration.sql`

This will:
- Create the `feedback` table with proper structure
- Set up Row Level Security (RLS) policies:
  - Anyone can view all feedback (public)
  - Only authenticated users can submit feedback
  - Users can only submit feedback with their own user_id
- Create indexes for better performance

## Features

- **Clean Scrollable Design**: Rounded cards for each feedback item
- **Subtle Add Button**: Click to open dialog with all fields
- **Two-Step Confirmation**:
  - First warning: "Your submission will be permanently visible to everyone"
  - Second confirmation: "This will be permanent and public. Are you sure?"
- **Permanent & Public**: Feedback cannot be deleted by users (only backend admin)
- **User Attribution**: Shows email of submitter
- **Real-time**: New submissions appear immediately
- **Simple Layout**: Clean, minimal design with proper spacing

## Usage

Once the table is created, users can:
1. Click the "Feedback" button in the header to navigate to `/feedback`
2. Click the subtle "+ Add" button
3. Write their feedback or feature suggestion
4. See permanent warning and click "Continue"
5. Confirm they want to make it public and permanent
6. Submit (permanently visible to everyone)

## Design

- **Rounded Cards**: Each feedback item has `rounded-2xl` for modern look
- **Hover Effects**: Cards have subtle shadow on hover
- **Dialog Form**: Clean modal with textarea and confirmation steps
- **Alert Components**: Visual warnings about permanence

## Admin Management

To delete inappropriate feedback, use Supabase dashboard:
1. Go to Table Editor
2. Select `feedback` table
3. Delete unwanted rows manually
