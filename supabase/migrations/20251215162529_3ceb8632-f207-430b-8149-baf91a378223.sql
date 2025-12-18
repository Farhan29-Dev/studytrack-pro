-- Add new columns to topics table for enhanced review system
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS summary text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quiz jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS required_reviews integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS revision_interval_days integer NOT NULL DEFAULT 3;

-- Create table for storing parsed syllabus data before final save
CREATE TABLE IF NOT EXISTS public.syllabus_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  parsed_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on syllabus_uploads
ALTER TABLE public.syllabus_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for syllabus_uploads
CREATE POLICY "Users can view their own uploads" 
ON public.syllabus_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own uploads" 
ON public.syllabus_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads" 
ON public.syllabus_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads" 
ON public.syllabus_uploads 
FOR DELETE 
USING (auth.uid() = user_id);