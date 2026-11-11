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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_events: {
        Row: {
          actor: string
          at: string
          detail: Json
          event: string
          id: number
          patient_id: string
          session_id: string | null
        }
        Insert: {
          actor: string
          at?: string
          detail?: Json
          event: string
          id?: never
          patient_id: string
          session_id?: string | null
        }
        Update: {
          actor?: string
          at?: string
          detail?: Json
          event?: string
          id?: never
          patient_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "share_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      care_team: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          organisation: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          organisation?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          organisation?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conditions: {
        Row: {
          clinician: string | null
          created_at: string
          diagnosed_note: string | null
          diagnosed_year: number | null
          id: string
          is_mental_health: boolean
          name: string
          specialty: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinician?: string | null
          created_at?: string
          diagnosed_note?: string | null
          diagnosed_year?: number | null
          id?: string
          is_mental_health?: boolean
          name: string
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          clinician?: string | null
          created_at?: string
          diagnosed_note?: string | null
          diagnosed_year?: number | null
          id?: string
          is_mental_health?: boolean
          name?: string
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          body: string | null
          clinician: string | null
          created_at: string
          detail: Json | null
          id: string
          is_mental_health: boolean
          kind: string
          occurs_at: string
          place: string | null
          session_id: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          clinician?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          is_mental_health?: boolean
          kind: string
          occurs_at: string
          place?: string | null
          session_id?: string | null
          source?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string | null
          clinician?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          is_mental_health?: boolean
          kind?: string
          occurs_at?: string
          place?: string | null
          session_id?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "share_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dose: string | null
          drug_class: string | null
          ended_on: string | null
          form: string | null
          frequency: string | null
          id: string
          indication: string | null
          instructions: string | null
          name: string
          prescriber: string | null
          prescriber_org: string | null
          prescriber_specialty: string | null
          refill_due_on: string | null
          started_on: string | null
          timing: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          drug_class?: string | null
          ended_on?: string | null
          form?: string | null
          frequency?: string | null
          id?: string
          indication?: string | null
          instructions?: string | null
          name: string
          prescriber?: string | null
          prescriber_org?: string | null
          prescriber_specialty?: string | null
          refill_due_on?: string | null
          started_on?: string | null
          timing?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          drug_class?: string | null
          ended_on?: string | null
          form?: string | null
          frequency?: string | null
          id?: string
          indication?: string | null
          instructions?: string | null
          name?: string
          prescriber?: string | null
          prescriber_org?: string | null
          prescriber_specialty?: string | null
          refill_due_on?: string | null
          started_on?: string | null
          timing?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          allergies: string[]
          blood_type: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_reminders: boolean
          first_name: string | null
          id: string
          implants: string[]
          is_demo: boolean
          last_name: string | null
          onboarding_step: string
          phone: string | null
          sex: string | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string[]
          blood_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_reminders?: boolean
          first_name?: string | null
          id: string
          implants?: string[]
          is_demo?: boolean
          last_name?: string | null
          onboarding_step?: string
          phone?: string | null
          sex?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string[]
          blood_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_reminders?: boolean
          first_name?: string | null
          id?: string
          implants?: string[]
          is_demo?: boolean
          last_name?: string | null
          onboarding_step?: string
          phone?: string | null
          sex?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      share_sessions: {
        Row: {
          allow_notes: boolean
          appointment_entry_id: string | null
          approved_at: string | null
          assessment: string | null
          chief_complaint: string | null
          clinician_name: string | null
          clinician_practice: string | null
          clinician_role: string | null
          code: string
          code_expires_at: string
          created_at: string
          duration_kind: string
          ended_at: string | null
          ended_by: string | null
          expires_at: string | null
          follow_up: string | null
          id: string
          notes_entry_id: string | null
          notes_updated_at: string | null
          patient_id: string
          paused_at: string | null
          plan: string | null
          portal_token_hash: string | null
          request_expires_at: string | null
          requested_at: string | null
          share_care_team: boolean
          share_conditions: boolean
          share_full_timeline: boolean
          share_mental_health: boolean
          share_recent_visits: boolean
          status: string
          updated_at: string
        }
        Insert: {
          allow_notes: boolean
          appointment_entry_id?: string | null
          approved_at?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinician_name?: string | null
          clinician_practice?: string | null
          clinician_role?: string | null
          code: string
          code_expires_at: string
          created_at?: string
          duration_kind: string
          ended_at?: string | null
          ended_by?: string | null
          expires_at?: string | null
          follow_up?: string | null
          id?: string
          notes_entry_id?: string | null
          notes_updated_at?: string | null
          patient_id: string
          paused_at?: string | null
          plan?: string | null
          portal_token_hash?: string | null
          request_expires_at?: string | null
          requested_at?: string | null
          share_care_team: boolean
          share_conditions: boolean
          share_full_timeline: boolean
          share_mental_health: boolean
          share_recent_visits: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          allow_notes?: boolean
          appointment_entry_id?: string | null
          approved_at?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          clinician_name?: string | null
          clinician_practice?: string | null
          clinician_role?: string | null
          code?: string
          code_expires_at?: string
          created_at?: string
          duration_kind?: string
          ended_at?: string | null
          ended_by?: string | null
          expires_at?: string | null
          follow_up?: string | null
          id?: string
          notes_entry_id?: string | null
          notes_updated_at?: string | null
          patient_id?: string
          paused_at?: string | null
          plan?: string | null
          portal_token_hash?: string | null
          request_expires_at?: string | null
          requested_at?: string | null
          share_care_team?: boolean
          share_conditions?: boolean
          share_full_timeline?: boolean
          share_mental_health?: boolean
          share_recent_visits?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_sessions_appointment_entry_id_fkey"
            columns: ["appointment_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_sessions_notes_entry_id_fkey"
            columns: ["notes_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          created_at: string
          diastolic: number | null
          heart_rate: number | null
          id: string
          recorded_on: string
          spo2: number | null
          systolic: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          recorded_on: string
          spo2?: number | null
          systolic?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          diastolic?: number | null
          heart_rate?: number | null
          id?: string
          recorded_on?: string
          spo2?: number | null
          systolic?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_demo_users: { Args: { server_secret: string }; Returns: Json }
      create_share_code: {
        Args: {
          allow_notes?: boolean
          appointment_entry_id?: string
          duration_kind?: string
          share_care_team?: boolean
          share_conditions?: boolean
          share_full_timeline?: boolean
          share_mental_health?: boolean
          share_recent_visits?: boolean
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      end_session: { Args: never; Returns: Json }
      export_my_data: { Args: never; Returns: Json }
      extend_session: { Args: { minutes: number }; Returns: Json }
      my_share_session: { Args: never; Returns: Json }
      portal_cancel_request: {
        Args: { portal_token: string; server_secret: string }
        Returns: Json
      }
      portal_end_session: {
        Args: { portal_token: string; server_secret: string }
        Returns: Json
      }
      portal_get_record: {
        Args: { portal_token: string; section: string; server_secret: string }
        Returns: Json
      }
      portal_save_notes: {
        Args: {
          assessment: string
          chief_complaint: string
          follow_up: string
          plan: string
          portal_token: string
          server_secret: string
        }
        Returns: Json
      }
      portal_status: {
        Args: { portal_token: string; server_secret: string }
        Returns: Json
      }
      portal_submit_code: {
        Args: {
          clinician_name: string
          clinician_practice: string
          clinician_role: string
          code: string
          ip_hash: string
          portal_token: string
          server_secret: string
        }
        Returns: Json
      }
      respond_to_request: {
        Args: { allow: boolean; session_id: string }
        Returns: Json
      }
      seed_demo_record: { Args: never; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
