// Database schema types for College Event & Club Hub (Section 5.3, user roles, and event approvals)
// Updated with club_id on profiles, refined relations, and decide_event RPC

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'student' | 'coordinator' | 'approver' | 'admin'
export type EventStatus = 'pending' | 'approved' | 'rejected'
export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled' | 'attended'

/** Result row of get_seat_counts() (live seats, FR-7) */
export interface SeatCountRow {
  event_id: string
  seat_limit: number
  seats_taken: number
  waitlist_count: number
}

/** Result row of get_my_registrations() (My Events, FR-10) */
export interface MyRegistrationRow {
  registration_id: string
  event_id: string
  reg_status: RegistrationStatus
  registered_at: string
  waitlist_position: number | null
  title: string
  date_time: string
  venue: string
  fee: number
  registration_deadline: string
  club_name: string
  certificate_issued: boolean
}

/** Result row of get_event_registrations() (coordinator view, FR-11) */
export interface EventRegistrationRow {
  registration_id: string
  student_id: string
  usn: string
  student_name: string | null
  phone: string | null
  email: string | null
  reg_status: RegistrationStatus
  registered_at: string
  waitlist_position: number | null
  certificate_issued: boolean
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          usn: string
          name: string | null
          phone: string | null
          email: string | null
          role: AppRole
          club_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          usn: string
          name?: string | null
          phone?: string | null
          email?: string | null
          role?: AppRole
          club_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usn?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          role?: AppRole
          club_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          }
        ]
      }
      clubs: {
        Row: {
          id: string
          name: string
          description: string | null
          faculty_mentor: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          faculty_mentor?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          faculty_mentor?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          club_id: string
          title: string
          description: string | null
          date_time: string
          venue: string
          contact: string | null
          fee: number
          seat_limit: number
          registration_deadline: string
          status: EventStatus
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          title: string
          description?: string | null
          date_time: string
          venue: string
          contact?: string | null
          fee?: number
          seat_limit: number
          registration_deadline: string
          status?: EventStatus
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          title?: string
          description?: string | null
          date_time?: string
          venue?: string
          contact?: string | null
          fee?: number
          seat_limit?: number
          registration_deadline?: string
          status?: EventStatus
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      registrations: {
        Row: {
          id: string
          event_id: string
          student_id: string
          status: RegistrationStatus
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          student_id: string
          status?: RegistrationStatus
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          student_id?: string
          status?: RegistrationStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      approvals: {
        Row: {
          id: string
          event_id: string
          approver_id: string
          status: EventStatus
          reason: string | null
          decided_at: string
        }
        Insert: {
          id?: string
          event_id: string
          approver_id: string
          status: EventStatus
          reason?: string | null
          decided_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          approver_id?: string
          status?: EventStatus
          reason?: string | null
          decided_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          event_id: string | null
          message: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id?: string | null
          message: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_id?: string | null
          message?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
      certificates: {
        Row: {
          id: string
          registration_id: string
          event_id: string
          student_id: string
          file_path: string
          issued_on: string
        }
        Insert: {
          id?: string
          registration_id: string
          event_id: string
          student_id: string
          file_path: string
          issued_on?: string
        }
        Update: {
          id?: string
          registration_id?: string
          event_id?: string
          student_id?: string
          file_path?: string
          issued_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { p_user_id: string }
        Returns: AppRole
      }
      get_user_club_id: {
        Args: { p_user_id: string }
        Returns: string | null
      }
      is_event_coordinator: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      decide_event: {
        Args: {
          p_event_id: string
          p_decision: string
          p_reason?: string | null
        }
        Returns: Json
      }
      register_for_event: {
        Args: { p_event_id: string }
        Returns: Json
      }
      cancel_registration: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      get_seat_counts: {
        Args: { p_event_ids: string[] }
        Returns: SeatCountRow[]
      }
      get_my_registrations: {
        Args: Record<PropertyKey, never>
        Returns: MyRegistrationRow[]
      }
      get_event_registrations: {
        Args: { p_event_id: string }
        Returns: EventRegistrationRow[]
      }
      mark_attendance: {
        Args: { p_event_id: string; p_attended_ids: string[] }
        Returns: Json
      }
      record_certificate: {
        Args: { p_registration_id: string; p_file_path: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: AppRole
      event_status: EventStatus
      registration_status: RegistrationStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
