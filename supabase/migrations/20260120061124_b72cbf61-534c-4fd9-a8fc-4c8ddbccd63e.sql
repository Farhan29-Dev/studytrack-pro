-- Add new columns to topics table for progressive reviews and confidence tracking
ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS review_level integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS confidence text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weak_areas jsonb DEFAULT NULL;

-- Add parent visibility columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS parent_visibility_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_share_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS energy_level text DEFAULT 'medium';

-- Create study_tasks table for planner functionality
CREATE TABLE public.study_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  is_completed boolean NOT NULL DEFAULT false,
  carry_over_from uuid REFERENCES public.study_tasks(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on study_tasks
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for study_tasks
CREATE POLICY "Users can view their own tasks"
ON public.study_tasks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
ON public.study_tasks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
ON public.study_tasks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
ON public.study_tasks FOR DELETE
USING (auth.uid() = user_id);

-- Create focus_sessions table for Pomodoro timer history
CREATE TABLE public.focus_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  duration_minutes integer NOT NULL,
  mode text NOT NULL DEFAULT 'pomodoro',
  completed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on focus_sessions
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for focus_sessions
CREATE POLICY "Users can view their own focus sessions"
ON public.focus_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own focus sessions"
ON public.focus_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own focus sessions"
ON public.focus_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Create tests table for MCQ test metadata
CREATE TABLE public.tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  topic_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  time_limit_minutes integer DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on tests
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tests
CREATE POLICY "Users can view their own tests"
ON public.tests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tests"
ON public.tests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tests"
ON public.tests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tests"
ON public.tests FOR DELETE
USING (auth.uid() = user_id);

-- Create test_questions table for individual test questions
CREATE TABLE public.test_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_index integer NOT NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  explanation text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on test_questions
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for test_questions (through test ownership)
CREATE POLICY "Users can view questions for their tests"
ON public.test_questions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tests WHERE tests.id = test_questions.test_id AND tests.user_id = auth.uid()
));

CREATE POLICY "Users can create questions for their tests"
ON public.test_questions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tests WHERE tests.id = test_questions.test_id AND tests.user_id = auth.uid()
));

CREATE POLICY "Users can update questions for their tests"
ON public.test_questions FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.tests WHERE tests.id = test_questions.test_id AND tests.user_id = auth.uid()
));

CREATE POLICY "Users can delete questions for their tests"
ON public.test_questions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.tests WHERE tests.id = test_questions.test_id AND tests.user_id = auth.uid()
));

-- Create test_results table for storing test attempts and scores
CREATE TABLE public.test_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]',
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  time_taken_seconds integer DEFAULT NULL,
  topic_scores jsonb DEFAULT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on test_results
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for test_results
CREATE POLICY "Users can view their own test results"
ON public.test_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own test results"
ON public.test_results FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_study_tasks_updated_at
BEFORE UPDATE ON public.study_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();