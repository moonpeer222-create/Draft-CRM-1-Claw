export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          branding: Json
          subscription_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          branding?: Json
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          branding?: Json
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          organization_id: string | null
          avatar_url: string | null
          last_seen: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          organization_id?: string | null
          avatar_url?: string | null
          last_seen?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          organization_id?: string | null
          avatar_url?: string | null
          last_seen?: string
          created_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          organization_id: string
          client_id: string | null
          agent_id: string | null
          case_number: string
          visa_type: string | null
          destination_country: string | null
          status: string
          priority: string
          meta: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          client_id?: string | null
          agent_id?: string | null
          case_number: string
          visa_type?: string | null
          destination_country?: string | null
          status?: string
          priority?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string | null
          agent_id?: string | null
          case_number?: string
          visa_type?: string | null
          destination_country?: string | null
          status?: string
          priority?: string
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          case_id: string | null
          uploaded_by: string | null
          file_name: string
          file_path: string
          file_type: string | null
          file_size: number | null
          is_verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          case_id?: string | null
          uploaded_by?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          file_size?: number | null
          is_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          case_id?: string | null
          uploaded_by?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          file_size?: number | null
          is_verified?: boolean
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          table_name: string | null
          record_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          table_name?: string | null
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action?: string
          table_name?: string | null
          record_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
