-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on subjects
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Subjects RLS policies
CREATE POLICY "Users can view their own subjects"
ON public.subjects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subjects"
ON public.subjects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subjects"
ON public.subjects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subjects"
ON public.subjects FOR DELETE
USING (auth.uid() = user_id);

-- Create units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Units RLS policies (access via subject ownership)
CREATE POLICY "Users can view units for their subjects"
ON public.units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subjects
    WHERE subjects.id = units.subject_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create units for their subjects"
ON public.units FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.subjects
    WHERE subjects.id = units.subject_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update units for their subjects"
ON public.units FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.subjects
    WHERE subjects.id = units.subject_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete units for their subjects"
ON public.units FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.subjects
    WHERE subjects.id = units.subject_id
    AND subjects.user_id = auth.uid()
  )
);

-- Create topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  review_count INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on topics
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Topics RLS policies (access via unit -> subject ownership)
CREATE POLICY "Users can view topics for their units"
ON public.topics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.units
    JOIN public.subjects ON subjects.id = units.subject_id
    WHERE units.id = topics.unit_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create topics for their units"
ON public.topics FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.units
    JOIN public.subjects ON subjects.id = units.subject_id
    WHERE units.id = topics.unit_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update topics for their units"
ON public.topics FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.units
    JOIN public.subjects ON subjects.id = units.subject_id
    WHERE units.id = topics.unit_id
    AND subjects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete topics for their units"
ON public.topics FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.units
    JOIN public.subjects ON subjects.id = units.subject_id
    WHERE units.id = topics.unit_id
    AND subjects.user_id = auth.uid()
  )
);

-- Create chat_messages table for AI buddy
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages RLS policies
CREATE POLICY "Users can view their own messages"
ON public.chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages"
ON public.chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update function for timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();