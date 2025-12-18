export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  subject_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Topic {
  id: string;
  unit_id: string;
  name: string;
  is_completed: boolean;
  last_reviewed: string | null;
  next_review: string | null;
  review_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  notes: string | null;
  summary: string | null;
  quiz: QuizQuestion[] | null;
  required_reviews: number;
  revision_interval_days: number;
  sort_order: number;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SubjectWithUnits extends Subject {
  units: UnitWithTopics[];
}

export interface UnitWithTopics extends Unit {
  topics: Topic[];
}

export interface ReviewTopic extends Topic {
  subject_name: string;
  subject_color: string;
  unit_name: string;
}

export interface ParsedSubject {
  name: string;
  color: string;
  units: ParsedUnit[];
}

export interface ParsedUnit {
  name: string;
  topics: string[];
}

export interface ParsedSyllabusData {
  subjects: ParsedSubject[];
}
