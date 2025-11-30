-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'feedback',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read all feedback (public viewing)
CREATE POLICY "Anyone can view feedback"
    ON public.feedback
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
    ON public.feedback
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index on created_at for faster ordering
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback(created_at DESC);

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS feedback_type_idx ON public.feedback(type);
