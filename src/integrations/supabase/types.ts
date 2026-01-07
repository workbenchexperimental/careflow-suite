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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          cedula: string
          created_at: string
          email: string
          id: string
          last_login: string | null
          nombre_completo: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cedula: string
          created_at?: string
          email: string
          id?: string
          last_login?: string | null
          nombre_completo: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cedula?: string
          created_at?: string
          email?: string
          id?: string
          last_login?: string | null
          nombre_completo?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evolutions: {
        Row: {
          bloqueado: boolean
          bloqueado_at: string | null
          concepto_profesional: string | null
          contenido: string
          created_at: string
          es_cierre: boolean
          evaluacion_final: string | null
          firma_url: string | null
          id: string
          plan_tratamiento: string | null
          procedimientos: string | null
          recomendaciones: string | null
          session_id: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          bloqueado?: boolean
          bloqueado_at?: string | null
          concepto_profesional?: string | null
          contenido: string
          created_at?: string
          es_cierre?: boolean
          evaluacion_final?: string | null
          firma_url?: string | null
          id?: string
          plan_tratamiento?: string | null
          procedimientos?: string | null
          recomendaciones?: string | null
          session_id: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          bloqueado?: boolean
          bloqueado_at?: string | null
          concepto_profesional?: string | null
          contenido?: string
          created_at?: string
          es_cierre?: boolean
          evaluacion_final?: string | null
          firma_url?: string | null
          id?: string
          plan_tratamiento?: string | null
          procedimientos?: string | null
          recomendaciones?: string | null
          session_id?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      initial_evaluations: {
        Row: {
          actividades_participacion: string | null
          codigo_cie10: string | null
          created_at: string
          diagnostico_cie10: string
          duracion_estimada: string | null
          estructuras_corporales: string | null
          factores_ambientales: string | null
          factores_personales: string | null
          frecuencia_sesiones: string | null
          funciones_corporales: string | null
          id: string
          medical_order_id: string
          objetivos_especificos: string | null
          objetivos_generales: string
          plan_intervencion: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          actividades_participacion?: string | null
          codigo_cie10?: string | null
          created_at?: string
          diagnostico_cie10: string
          duracion_estimada?: string | null
          estructuras_corporales?: string | null
          factores_ambientales?: string | null
          factores_personales?: string | null
          frecuencia_sesiones?: string | null
          funciones_corporales?: string | null
          id?: string
          medical_order_id: string
          objetivos_especificos?: string | null
          objetivos_generales: string
          plan_intervencion: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          actividades_participacion?: string | null
          codigo_cie10?: string | null
          created_at?: string
          diagnostico_cie10?: string
          duracion_estimada?: string | null
          estructuras_corporales?: string | null
          factores_ambientales?: string | null
          factores_personales?: string | null
          frecuencia_sesiones?: string | null
          funciones_corporales?: string | null
          id?: string
          medical_order_id?: string
          objetivos_especificos?: string | null
          objetivos_generales?: string
          plan_intervencion?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initial_evaluations_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: true
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initial_evaluations_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_orders: {
        Row: {
          closed_at: string | null
          codigo_orden: string | null
          created_at: string
          created_by: string | null
          diagnostico: string | null
          especialidad: Database["public"]["Enums"]["especialidad"]
          estado: Database["public"]["Enums"]["estado_orden"]
          grupo_orden: string | null
          id: string
          observaciones: string | null
          patient_id: string
          sesiones_completadas: number
          therapist_id: string
          total_sesiones: number
          ubicacion: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          codigo_orden?: string | null
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          especialidad: Database["public"]["Enums"]["especialidad"]
          estado?: Database["public"]["Enums"]["estado_orden"]
          grupo_orden?: string | null
          id?: string
          observaciones?: string | null
          patient_id: string
          sesiones_completadas?: number
          therapist_id: string
          total_sesiones: number
          ubicacion?: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          codigo_orden?: string | null
          created_at?: string
          created_by?: string | null
          diagnostico?: string | null
          especialidad?: Database["public"]["Enums"]["especialidad"]
          estado?: Database["public"]["Enums"]["estado_orden"]
          grupo_orden?: string | null
          id?: string
          observaciones?: string | null
          patient_id?: string
          sesiones_completadas?: number
          therapist_id?: string
          total_sesiones?: number
          ubicacion?: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_orders_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transfers: {
        Row: {
          created_at: string
          from_therapist_id: string
          id: string
          medical_order_id: string
          motivo: string
          to_therapist_id: string
          transferred_by: string
        }
        Insert: {
          created_at?: string
          from_therapist_id: string
          id?: string
          medical_order_id: string
          motivo: string
          to_therapist_id: string
          transferred_by: string
        }
        Update: {
          created_at?: string
          from_therapist_id?: string
          id?: string
          medical_order_id?: string
          motivo?: string
          to_therapist_id?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_transfers_from_therapist_id_fkey"
            columns: ["from_therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_transfers_to_therapist_id_fkey"
            columns: ["to_therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string
          file_type: string | null
          file_url: string
          id: string
          nombre: string
          patient_id: string
          tipo: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          file_url: string
          id?: string
          nombre: string
          patient_id: string
          tipo: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          file_url?: string
          id?: string
          nombre?: string
          patient_id?: string
          tipo?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          activo: boolean
          acudiente_nombre: string
          acudiente_parentesco: string
          acudiente_telefono: string
          cedula: string | null
          ciudad: string | null
          created_at: string
          created_by: string | null
          direccion: string | null
          email: string | null
          eps: string | null
          fecha_nacimiento: string
          id: string
          nombre_completo: string
          ocupacion: string | null
          sexo: Database["public"]["Enums"]["sexo"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          acudiente_nombre: string
          acudiente_parentesco: string
          acudiente_telefono: string
          cedula?: string | null
          ciudad?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          eps?: string | null
          fecha_nacimiento: string
          id?: string
          nombre_completo: string
          ocupacion?: string | null
          sexo: Database["public"]["Enums"]["sexo"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          acudiente_nombre?: string
          acudiente_parentesco?: string
          acudiente_telefono?: string
          cedula?: string | null
          ciudad?: string | null
          created_at?: string
          created_by?: string | null
          direccion?: string | null
          email?: string | null
          eps?: string | null
          fecha_nacimiento?: string
          id?: string
          nombre_completo?: string
          ocupacion?: string | null
          sexo?: Database["public"]["Enums"]["sexo"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payroll_details: {
        Row: {
          created_at: string
          es_por_hora: boolean
          horas_domiciliaria: number
          horas_intramural: number
          id: string
          notas: string | null
          period_id: string
          sesiones_domiciliaria: number
          sesiones_intramural: number
          subtotal_domiciliaria: number
          subtotal_intramural: number
          tarifa_hora_domiciliaria: number | null
          tarifa_hora_intramural: number | null
          tarifa_sesion_domiciliaria: number | null
          tarifa_sesion_intramural: number | null
          therapist_id: string
          total_bruto: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          es_por_hora?: boolean
          horas_domiciliaria?: number
          horas_intramural?: number
          id?: string
          notas?: string | null
          period_id: string
          sesiones_domiciliaria?: number
          sesiones_intramural?: number
          subtotal_domiciliaria?: number
          subtotal_intramural?: number
          tarifa_hora_domiciliaria?: number | null
          tarifa_hora_intramural?: number | null
          tarifa_sesion_domiciliaria?: number | null
          tarifa_sesion_intramural?: number | null
          therapist_id: string
          total_bruto?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          es_por_hora?: boolean
          horas_domiciliaria?: number
          horas_intramural?: number
          id?: string
          notas?: string | null
          period_id?: string
          sesiones_domiciliaria?: number
          sesiones_intramural?: number
          subtotal_domiciliaria?: number
          subtotal_intramural?: number
          tarifa_hora_domiciliaria?: number | null
          tarifa_hora_intramural?: number | null
          tarifa_sesion_domiciliaria?: number | null
          tarifa_sesion_intramural?: number | null
          therapist_id?: string
          total_bruto?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_details_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_details_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          anio: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["estado_periodo"]
          fecha_fin: string
          fecha_inicio: string
          id: string
          mes: number
          notas: string | null
          paid_at: string | null
        }
        Insert: {
          anio: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_periodo"]
          fecha_fin: string
          fecha_inicio: string
          id?: string
          mes: number
          notas?: string | null
          paid_at?: string | null
        }
        Update: {
          anio?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["estado_periodo"]
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          mes?: number
          notas?: string | null
          paid_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["estado_sesion"]
          fecha_programada: string
          hora_fin: string | null
          hora_inicio: string
          id: string
          medical_order_id: string
          notas_cancelacion: string | null
          numero_sesion: number
          reprogramada_a: string | null
          reprogramada_de: string | null
          ubicacion: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_sesion"]
          fecha_programada: string
          hora_fin?: string | null
          hora_inicio: string
          id?: string
          medical_order_id: string
          notas_cancelacion?: string | null
          numero_sesion: number
          reprogramada_a?: string | null
          reprogramada_de?: string | null
          ubicacion?: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_sesion"]
          fecha_programada?: string
          hora_fin?: string | null
          hora_inicio?: string
          id?: string
          medical_order_id?: string
          notas_cancelacion?: string | null
          numero_sesion?: number
          reprogramada_a?: string | null
          reprogramada_de?: string | null
          ubicacion?: Database["public"]["Enums"]["ubicacion_sesion"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_medical_order_id_fkey"
            columns: ["medical_order_id"]
            isOneToOne: false
            referencedRelation: "medical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_reprogramada_a_fkey"
            columns: ["reprogramada_a"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_reprogramada_de_fkey"
            columns: ["reprogramada_de"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profiles: {
        Row: {
          activo: boolean
          cedula: string
          created_at: string
          email: string
          especialidad: Database["public"]["Enums"]["especialidad"]
          firma_digital_url: string | null
          id: string
          last_login: string | null
          nombre_completo: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          cedula: string
          created_at?: string
          email: string
          especialidad: Database["public"]["Enums"]["especialidad"]
          firma_digital_url?: string | null
          id?: string
          last_login?: string | null
          nombre_completo: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          cedula?: string
          created_at?: string
          email?: string
          especialidad?: Database["public"]["Enums"]["especialidad"]
          firma_digital_url?: string | null
          id?: string
          last_login?: string | null
          nombre_completo?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      therapist_rates: {
        Row: {
          activo: boolean
          created_at: string
          es_por_hora: boolean
          especialidad: Database["public"]["Enums"]["especialidad"]
          id: string
          therapist_id: string
          updated_at: string
          valor_hora: number | null
          valor_hora_domiciliaria: number | null
          valor_sesion: number | null
          valor_sesion_domiciliaria: number | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_por_hora?: boolean
          especialidad: Database["public"]["Enums"]["especialidad"]
          id?: string
          therapist_id: string
          updated_at?: string
          valor_hora?: number | null
          valor_hora_domiciliaria?: number | null
          valor_sesion?: number | null
          valor_sesion_domiciliaria?: number | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_por_hora?: boolean
          especialidad?: Database["public"]["Enums"]["especialidad"]
          id?: string
          therapist_id?: string
          updated_at?: string
          valor_hora?: number | null
          valor_hora_domiciliaria?: number | null
          valor_sesion?: number | null
          valor_sesion_domiciliaria?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_rates_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_therapist_profile_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_therapist: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "terapeuta"
      especialidad:
        | "fisioterapia"
        | "fonoaudiologia"
        | "terapia_ocupacional"
        | "psicologia"
        | "terapia_acuatica"
      estado_orden: "activa" | "cerrada"
      estado_periodo: "abierto" | "cerrado" | "pagado"
      estado_sesion:
        | "programada"
        | "completada"
        | "cancelada"
        | "reprogramada"
        | "plan_casero"
      sexo: "masculino" | "femenino" | "otro"
      ubicacion_sesion: "intramural" | "domiciliaria"
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
      app_role: ["admin", "terapeuta"],
      especialidad: [
        "fisioterapia",
        "fonoaudiologia",
        "terapia_ocupacional",
        "psicologia",
        "terapia_acuatica",
      ],
      estado_orden: ["activa", "cerrada"],
      estado_periodo: ["abierto", "cerrado", "pagado"],
      estado_sesion: [
        "programada",
        "completada",
        "cancelada",
        "reprogramada",
        "plan_casero",
      ],
      sexo: ["masculino", "femenino", "otro"],
      ubicacion_sesion: ["intramural", "domiciliaria"],
    },
  },
} as const
