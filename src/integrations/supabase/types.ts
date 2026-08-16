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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          agreed_rate: number
          co2_avoided: number | null
          created_at: string
          driver_id: string | null
          empty_km_avoided: number | null
          fuel_saved: number | null
          id: string
          load_id: string | null
          shipper_id: string | null
          status: string
          truck_id: string | null
          updated_at: string
        }
        Insert: {
          agreed_rate: number
          co2_avoided?: number | null
          created_at?: string
          driver_id?: string | null
          empty_km_avoided?: number | null
          fuel_saved?: number | null
          id?: string
          load_id?: string | null
          shipper_id?: string | null
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Update: {
          agreed_rate?: number
          co2_avoided?: number | null
          created_at?: string
          driver_id?: string | null
          empty_km_avoided?: number | null
          fuel_saved?: number | null
          id?: string
          load_id?: string | null
          shipper_id?: string | null
          status?: string
          truck_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          additional_income: number
          capacity: number | null
          completed_trips: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          empty_km_avoided: number
          fuel_type: string | null
          id: string
          is_demo: boolean
          kyc_status: string
          language: string | null
          name: string
          phone: string | null
          preferred_routes: Json | null
          return_loads_found: number
          truck_type: string | null
          trust_score: number
          updated_at: string
          user_id: string | null
          vehicle_model: string | null
        }
        Insert: {
          additional_income?: number
          capacity?: number | null
          completed_trips?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          empty_km_avoided?: number
          fuel_type?: string | null
          id?: string
          is_demo?: boolean
          kyc_status?: string
          language?: string | null
          name: string
          phone?: string | null
          preferred_routes?: Json | null
          return_loads_found?: number
          truck_type?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          vehicle_model?: string | null
        }
        Update: {
          additional_income?: number
          capacity?: number | null
          completed_trips?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          empty_km_avoided?: number
          fuel_type?: string | null
          id?: string
          is_demo?: boolean
          kyc_status?: string
          language?: string | null
          name?: string
          phone?: string | null
          preferred_routes?: Json | null
          return_loads_found?: number
          truck_type?: string | null
          trust_score?: number
          updated_at?: string
          user_id?: string | null
          vehicle_model?: string | null
        }
        Relationships: []
      }
      loads: {
        Row: {
          budget: number
          cargo_type: string
          created_at: string
          delivery_lat: number
          delivery_lng: number
          delivery_location: string
          id: string
          is_demo: boolean
          pickup_lat: number
          pickup_lng: number
          pickup_location: string
          pickup_time: string
          shipper_id: string | null
          status: string
          truck_type: string
          updated_at: string
          weight: number
        }
        Insert: {
          budget: number
          cargo_type?: string
          created_at?: string
          delivery_lat: number
          delivery_lng: number
          delivery_location: string
          id?: string
          is_demo?: boolean
          pickup_lat: number
          pickup_lng: number
          pickup_location: string
          pickup_time?: string
          shipper_id?: string | null
          status?: string
          truck_type?: string
          updated_at?: string
          weight: number
        }
        Update: {
          budget?: number
          cargo_type?: string
          created_at?: string
          delivery_lat?: number
          delivery_lng?: number
          delivery_location?: string
          id?: string
          is_demo?: boolean
          pickup_lat?: number
          pickup_lng?: number
          pickup_location?: string
          pickup_time?: string
          shipper_id?: string | null
          status?: string
          truck_type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "loads_shipper_id_fkey"
            columns: ["shipper_id"]
            isOneToOne: false
            referencedRelation: "shippers"
            referencedColumns: ["id"]
          },
        ]
      }
      location_updates: {
        Row: {
          heading: number | null
          id: string
          lat: number
          lng: number
          speed: number | null
          timestamp: string
          truck_id: string | null
        }
        Insert: {
          heading?: number | null
          id?: string
          lat: number
          lng: number
          speed?: number | null
          timestamp?: string
          truck_id?: string | null
        }
        Update: {
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          speed?: number | null
          timestamp?: string
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_updates_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          payment_type: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_type?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_type?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_validation: {
        Row: {
          created_at: string
          id: string
          metric: string
          notes: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          notes?: string | null
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          notes?: string | null
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          language: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          language?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          language?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          booking_id: string | null
          comment: string | null
          communication: number | null
          created_at: string
          id: string
          on_time: number | null
          payment_reliability: number | null
          professionalism: number | null
          rater_id: string | null
          stars: number
          target_type: string
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          on_time?: number | null
          payment_reliability?: number | null
          professionalism?: number | null
          rater_id?: string | null
          stars: number
          target_type: string
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          on_time?: number | null
          payment_reliability?: number | null
          professionalism?: number | null
          rater_id?: string | null
          stars?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      return_load_opportunities: {
        Row: {
          capacity_score: number | null
          created_at: string
          distance_score: number | null
          empty_km_avoided: number | null
          estimated_co2_avoided: number | null
          estimated_earning: number | null
          estimated_fuel_saved: number | null
          id: string
          load_id: string | null
          match_score: number
          price_score: number | null
          reasons: Json | null
          route_score: number | null
          status: string
          timing_score: number | null
          truck_id: string | null
          trust_score: number | null
        }
        Insert: {
          capacity_score?: number | null
          created_at?: string
          distance_score?: number | null
          empty_km_avoided?: number | null
          estimated_co2_avoided?: number | null
          estimated_earning?: number | null
          estimated_fuel_saved?: number | null
          id?: string
          load_id?: string | null
          match_score: number
          price_score?: number | null
          reasons?: Json | null
          route_score?: number | null
          status?: string
          timing_score?: number | null
          truck_id?: string | null
          trust_score?: number | null
        }
        Update: {
          capacity_score?: number | null
          created_at?: string
          distance_score?: number | null
          empty_km_avoided?: number | null
          estimated_co2_avoided?: number | null
          estimated_earning?: number | null
          estimated_fuel_saved?: number | null
          id?: string
          load_id?: string | null
          match_score?: number
          price_score?: number | null
          reasons?: Json | null
          route_score?: number | null
          status?: string
          timing_score?: number | null
          truck_id?: string | null
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "return_load_opportunities_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_load_opportunities_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      shippers: {
        Row: {
          business_type: string | null
          company_name: string
          created_at: string
          id: string
          is_demo: boolean
          phone: string | null
          trust_score: number
          user_id: string | null
          verification_status: string
        }
        Insert: {
          business_type?: string | null
          company_name: string
          created_at?: string
          id?: string
          is_demo?: boolean
          phone?: string | null
          trust_score?: number
          user_id?: string | null
          verification_status?: string
        }
        Update: {
          business_type?: string | null
          company_name?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          phone?: string | null
          trust_score?: number
          user_id?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          actual_arrival: string | null
          booking_id: string | null
          created_at: string
          destination: string | null
          destination_lat: number | null
          destination_lng: number | null
          estimated_arrival: string | null
          id: string
          is_demo: boolean
          progress: number
          start_lat: number | null
          start_lng: number | null
          start_location: string | null
          status: string
          truck_id: string | null
        }
        Insert: {
          actual_arrival?: string | null
          booking_id?: string | null
          created_at?: string
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          estimated_arrival?: string | null
          id?: string
          is_demo?: boolean
          progress?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          status?: string
          truck_id?: string | null
        }
        Update: {
          actual_arrival?: string | null
          booking_id?: string | null
          created_at?: string
          destination?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          estimated_arrival?: string | null
          id?: string
          is_demo?: boolean
          progress?: number
          start_lat?: number | null
          start_lng?: number | null
          start_location?: string | null
          status?: string
          truck_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_truck_id_fkey"
            columns: ["truck_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          available_from: string | null
          capacity: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          destination_city: string | null
          destination_lat: number | null
          destination_lng: number | null
          driver_id: string | null
          fuel_type: string | null
          id: string
          is_demo: boolean
          registration_number: string
          status: string
          truck_type: string
          updated_at: string
          vehicle_model: string | null
          verified: boolean
        }
        Insert: {
          available_from?: string | null
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          fuel_type?: string | null
          id?: string
          is_demo?: boolean
          registration_number: string
          status?: string
          truck_type?: string
          updated_at?: string
          vehicle_model?: string | null
          verified?: boolean
        }
        Update: {
          available_from?: string | null
          capacity?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          fuel_type?: string | null
          id?: string
          is_demo?: boolean
          registration_number?: string
          status?: string
          truck_type?: string
          updated_at?: string
          vehicle_model?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "trucks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "DRIVER" | "SHIPPER" | "ADMIN"
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
    Enums: {
      app_role: ["DRIVER", "SHIPPER", "ADMIN"],
    },
  },
} as const
