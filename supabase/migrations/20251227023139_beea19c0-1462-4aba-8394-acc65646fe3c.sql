-- =============================================
-- ERP CLÍNICO - FASE 1: ESTRUCTURA DE BASE DE DATOS
-- =============================================

-- 1. ENUM TYPES
-- =============================================

-- Roles del sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'terapeuta');

-- Especialidades terapéuticas
CREATE TYPE public.especialidad AS ENUM (
  'fisioterapia',
  'fonoaudiologia',
  'terapia_ocupacional',
  'psicologia',
  'terapia_acuatica'
);

-- Estados de órdenes médicas
CREATE TYPE public.estado_orden AS ENUM ('activa', 'cerrada');

-- Estados de sesiones
CREATE TYPE public.estado_sesion AS ENUM (
  'programada',
  'completada',
  'cancelada',
  'reprogramada',
  'plan_casero'
);

-- Tipos de ubicación de sesión
CREATE TYPE public.ubicacion_sesion AS ENUM ('intramural', 'domiciliaria');

-- Sexo del paciente
CREATE TYPE public.sexo AS ENUM ('masculino', 'femenino', 'otro');

-- =============================================
-- 2. TABLAS PRINCIPALES
-- =============================================

-- Tabla de roles de usuario (separada para seguridad)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Perfiles de terapeutas
CREATE TABLE public.therapist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cedula VARCHAR(20) NOT NULL UNIQUE,
  nombre_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  especialidad especialidad NOT NULL,
  firma_digital_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Perfiles de administradores
CREATE TABLE public.admin_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cedula VARCHAR(20) NOT NULL UNIQUE,
  nombre_completo VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Pacientes
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(255) NOT NULL,
  cedula VARCHAR(20) UNIQUE,
  sexo sexo NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  ciudad VARCHAR(100),
  direccion TEXT,
  eps VARCHAR(100),
  ocupacion VARCHAR(100),
  telefono VARCHAR(20),
  email VARCHAR(255),
  -- Datos del acudiente (obligatorios)
  acudiente_nombre VARCHAR(255) NOT NULL,
  acudiente_telefono VARCHAR(20) NOT NULL,
  acudiente_parentesco VARCHAR(50) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Documentos adjuntos de pacientes
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'remision', 'rx', 'laboratorio', 'otro'
  file_url TEXT NOT NULL,
  file_type VARCHAR(50), -- 'pdf', 'image'
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Órdenes médicas (paquetes)
CREATE TABLE public.medical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  especialidad especialidad NOT NULL,
  total_sesiones INTEGER NOT NULL CHECK (total_sesiones > 0),
  sesiones_completadas INTEGER NOT NULL DEFAULT 0,
  ubicacion ubicacion_sesion NOT NULL DEFAULT 'intramural',
  estado estado_orden NOT NULL DEFAULT 'activa',
  diagnostico TEXT,
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Sesiones individuales
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_order_id UUID REFERENCES public.medical_orders(id) ON DELETE CASCADE NOT NULL,
  numero_sesion INTEGER NOT NULL,
  fecha_programada DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME,
  estado estado_sesion NOT NULL DEFAULT 'programada',
  ubicacion ubicacion_sesion NOT NULL DEFAULT 'intramural',
  notas_cancelacion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Evoluciones clínicas
CREATE TABLE public.evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  contenido TEXT NOT NULL,
  procedimientos TEXT,
  plan_tratamiento TEXT,
  -- Campos para cierre (última sesión)
  es_cierre BOOLEAN NOT NULL DEFAULT false,
  evaluacion_final TEXT,
  concepto_profesional TEXT,
  recomendaciones TEXT,
  -- Firma y bloqueo
  firma_url TEXT,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  bloqueado_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tarifas de terapeutas
CREATE TABLE public.therapist_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES public.therapist_profiles(id) ON DELETE CASCADE NOT NULL,
  especialidad especialidad NOT NULL,
  valor_sesion DECIMAL(10,2),
  valor_hora DECIMAL(10,2),
  es_por_hora BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, especialidad)
);

-- Registro de auditoría de accesos
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 3. FUNCIONES DE SEGURIDAD
-- =============================================

-- Función para verificar rol (evita recursión en RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para verificar si es admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Función para verificar si es terapeuta
CREATE OR REPLACE FUNCTION public.is_therapist(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'terapeuta')
$$;

-- Función para obtener el perfil del terapeuta por user_id
CREATE OR REPLACE FUNCTION public.get_therapist_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.therapist_profiles WHERE user_id = _user_id LIMIT 1
$$;

-- =============================================
-- 4. TRIGGERS Y FUNCIONES AUXILIARES
-- =============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers de updated_at
CREATE TRIGGER update_therapist_profiles_updated_at
  BEFORE UPDATE ON public.therapist_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_profiles_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_orders_updated_at
  BEFORE UPDATE ON public.medical_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evolutions_updated_at
  BEFORE UPDATE ON public.evolutions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapist_rates_updated_at
  BEFORE UPDATE ON public.therapist_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para bloquear evoluciones después de 24 horas
CREATE OR REPLACE FUNCTION public.check_evolution_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.bloqueado = true THEN
    RAISE EXCEPTION 'Esta evolución está bloqueada y no puede ser modificada';
  END IF;
  
  -- Bloquear si han pasado más de 24 horas
  IF OLD.created_at < (now() - INTERVAL '24 hours') THEN
    NEW.bloqueado = true;
    NEW.bloqueado_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER check_evolution_lock_trigger
  BEFORE UPDATE ON public.evolutions
  FOR EACH ROW EXECUTE FUNCTION public.check_evolution_lock();

-- Función para actualizar sesiones_completadas en medical_orders
CREATE OR REPLACE FUNCTION public.update_sesiones_completadas()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.medical_orders
  SET sesiones_completadas = (
    SELECT COUNT(*) FROM public.sessions 
    WHERE medical_order_id = COALESCE(NEW.medical_order_id, OLD.medical_order_id)
    AND estado IN ('completada', 'plan_casero')
  )
  WHERE id = COALESCE(NEW.medical_order_id, OLD.medical_order_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sesiones_completadas_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_sesiones_completadas();

-- =============================================
-- 5. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Políticas para therapist_profiles
CREATE POLICY "Therapists can view their own profile"
  ON public.therapist_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all therapist profiles"
  ON public.therapist_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can update their own profile"
  ON public.therapist_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage therapist profiles"
  ON public.therapist_profiles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Políticas para admin_profiles
CREATE POLICY "Admins can view their own profile"
  ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all admin profiles"
  ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update their own profile"
  ON public.admin_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Políticas para patients
CREATE POLICY "Admins can manage all patients"
  ON public.patients FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view assigned patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    public.is_therapist(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM public.medical_orders mo
        JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
        WHERE mo.patient_id = patients.id
        AND tp.user_id = auth.uid()
      )
    )
  );

-- Políticas para patient_documents
CREATE POLICY "Admins can manage all patient documents"
  ON public.patient_documents FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view documents of assigned patients"
  ON public.patient_documents FOR SELECT
  TO authenticated
  USING (
    public.is_therapist(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM public.medical_orders mo
        JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
        WHERE mo.patient_id = patient_documents.patient_id
        AND tp.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Therapists can upload documents for assigned patients"
  ON public.patient_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_therapist(auth.uid()) AND (
      EXISTS (
        SELECT 1 FROM public.medical_orders mo
        JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
        WHERE mo.patient_id = patient_documents.patient_id
        AND tp.user_id = auth.uid()
      )
    )
  );

-- Políticas para medical_orders
CREATE POLICY "Admins can manage all medical orders"
  ON public.medical_orders FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view their own medical orders"
  ON public.medical_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE tp.id = medical_orders.therapist_id
      AND tp.user_id = auth.uid()
    )
  );

-- Políticas para sessions
CREATE POLICY "Admins can manage all sessions"
  ON public.sessions FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view their own sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_orders mo
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE mo.id = sessions.medical_order_id
      AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Therapists can update their own sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.medical_orders mo
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE mo.id = sessions.medical_order_id
      AND tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medical_orders mo
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE mo.id = sessions.medical_order_id
      AND tp.user_id = auth.uid()
    )
  );

-- Políticas para evolutions
CREATE POLICY "Admins can view all evolutions"
  ON public.evolutions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view evolutions of their patients"
  ON public.evolutions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE s.id = evolutions.session_id
      AND tp.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      WHERE s.id = evolutions.session_id
      AND mo.patient_id IN (
        SELECT DISTINCT mo2.patient_id FROM public.medical_orders mo2
        JOIN public.therapist_profiles tp2 ON mo2.therapist_id = tp2.id
        WHERE tp2.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Therapists can create their own evolutions"
  ON public.evolutions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE tp.id = evolutions.therapist_id
      AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "Therapists can update their own evolutions if not locked"
  ON public.evolutions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE tp.id = evolutions.therapist_id
      AND tp.user_id = auth.uid()
    )
    AND bloqueado = false
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE tp.id = evolutions.therapist_id
      AND tp.user_id = auth.uid()
    )
  );

-- Políticas para therapist_rates
CREATE POLICY "Admins can manage all rates"
  ON public.therapist_rates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view their own rates"
  ON public.therapist_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE tp.id = therapist_rates.therapist_id
      AND tp.user_id = auth.uid()
    )
  );

-- Políticas para access_logs
CREATE POLICY "Users can insert their own access logs"
  ON public.access_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- =============================================
-- 6. STORAGE BUCKETS
-- =============================================

-- Bucket para firmas digitales (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);

-- Bucket para documentos de pacientes (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false);

-- Políticas de storage para signatures
CREATE POLICY "Therapists can upload their own signature"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signatures' 
    AND public.is_therapist(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Therapists can view their own signature"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'signatures' 
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Therapists can update their own signature"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'signatures' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Políticas de storage para patient-documents
CREATE POLICY "Admins can manage all patient documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'patient-documents' 
    AND public.is_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'patient-documents' 
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Therapists can upload patient documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient-documents' 
    AND public.is_therapist(auth.uid())
  );

CREATE POLICY "Therapists can view patient documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patient-documents' 
    AND public.is_therapist(auth.uid())
  );

-- =============================================
-- 7. ÍNDICES PARA RENDIMIENTO
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_therapist_profiles_user_id ON public.therapist_profiles(user_id);
CREATE INDEX idx_therapist_profiles_especialidad ON public.therapist_profiles(especialidad);
CREATE INDEX idx_patients_activo ON public.patients(activo);
CREATE INDEX idx_medical_orders_patient_id ON public.medical_orders(patient_id);
CREATE INDEX idx_medical_orders_therapist_id ON public.medical_orders(therapist_id);
CREATE INDEX idx_medical_orders_estado ON public.medical_orders(estado);
CREATE INDEX idx_sessions_medical_order_id ON public.sessions(medical_order_id);
CREATE INDEX idx_sessions_fecha_programada ON public.sessions(fecha_programada);
CREATE INDEX idx_sessions_estado ON public.sessions(estado);
CREATE INDEX idx_evolutions_session_id ON public.evolutions(session_id);
CREATE INDEX idx_evolutions_therapist_id ON public.evolutions(therapist_id);