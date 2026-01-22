export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed_at: string
          duration_minutes: number
          id: string
          mode: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          duration_minutes: number
          id?: string
          mode?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          duration_minutes?: number
          id?: string
          mode?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          energy_level: string | null
          id: string
          name: string | null
          parent_share_code: string | null
          parent_visibility_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          energy_level?: string | null
          id?: string
          name?: string | null
          parent_share_code?: string | null
          parent_visibility_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          energy_level?: string | null
          id?: string
          name?: string | null
          parent_share_code?: string | null
          parent_visibility_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_tasks: {
        Row: {
          carry_over_from: string | null
          created_at: string
          id: string
          is_completed: boolean
          scheduled_date: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carry_over_from?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          scheduled_date?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carry_over_from?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          scheduled_date?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_tasks_carry_over_from_fkey"
            columns: ["carry_over_from"]
            isOneToOne: false
            referencedRelation: "study_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syllabus_uploads: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          id: string
          parsed_data: Json
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type: string
          id?: string
          parsed_data: Json
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          id?: string
          parsed_data?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      test_questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          options: Json
          question: string
          test_id: string
          topic_id: string | null
        }
        Insert: {
          correct_index: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          question: string
          test_id: string
          topic_id?: string | null
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          test_id?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          score: number
          test_id: string
          time_taken_seconds: number | null
          topic_scores: Json | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          id?: string
          score?: number
          test_id: string
          time_taken_seconds?: number | null
          topic_scores?: Json | null
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          score?: number
          test_id?: string
          time_taken_seconds?: number | null
          topic_scores?: Json | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string
          id: string
          status: string
          subject_ids: string[]
          time_limit_minutes: number | null
          title: string
          topic_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject_ids?: string[]
          time_limit_minutes?: number | null
          title: string
          topic_ids?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject_ids?: string[]
          time_limit_minutes?: number | null
          title?: string
          topic_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          confidence: string | null
          created_at: string
          difficulty: string
          id: string
          is_completed: boolean
          last_reviewed: string | null
          name: string
          next_review: string | null
          notes: string | null
          quiz: Json | null
          required_reviews: number
          review_count: number
          review_level: number
          revision_interval_days: number
          sort_order: number
          summary: string | null
          unit_id: string
          weak_areas: Json | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_completed?: boolean
          last_reviewed?: string | null
          name: string
          next_review?: string | null
          notes?: string | null
          quiz?: Json | null
          required_reviews?: number
          review_count?: number
          review_level?: number
          revision_interval_days?: number
          sort_order?: number
          summary?: string | null
          unit_id: string
          weak_areas?: Json | null
        }
        Update: {
          confidence?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          is_completed?: boolean
          last_reviewed?: string | null
          name?: string
          next_review?: string | null
          notes?: string | null
          quiz?: Json | null
          required_reviews?: number
          review_count?: number
          review_level?: number
          revision_interval_days?: number
          sort_order?: number
          summary?: string | null
          unit_id?: string
          weak_areas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
