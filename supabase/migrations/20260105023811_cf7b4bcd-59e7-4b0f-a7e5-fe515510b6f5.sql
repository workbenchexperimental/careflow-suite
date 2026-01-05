-- ============================================
-- FASE 1: INMUTABILIDAD DE EVOLUCIONES
-- Eliminar política de UPDATE - las evoluciones son SIEMPRE inmutables
-- ============================================

DROP POLICY IF EXISTS "Assigned therapists can update within 24h" ON public.evolutions;

-- ============================================
-- FASE 2: CREAR TABLA DE EVALUACIÓN INICIAL
-- Cada paquete (orden médica por especialidad) requiere evaluación inicial
-- ============================================

CREATE TABLE IF NOT EXISTS public.initial_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_order_id UUID REFERENCES public.medical_orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
  therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  
  -- Diagnóstico CIE-10
  diagnostico_cie10 TEXT NOT NULL,
  codigo_cie10 VARCHAR(50),
  
  -- Evaluación CIF - Clasificación Internacional del Funcionamiento
  funciones_corporales TEXT,
  estructuras_corporales TEXT,
  actividades_participacion TEXT,
  factores_ambientales TEXT,
  factores_personales TEXT,
  
  -- Plan de tratamiento
  objetivos_generales TEXT NOT NULL,
  objetivos_especificos TEXT,
  plan_intervencion TEXT NOT NULL,
  frecuencia_sesiones VARCHAR(100),
  duracion_estimada VARCHAR(100),
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.initial_evaluations ENABLE ROW LEVEL SECURITY;

-- Solo terapeuta asignado puede crear (una vez por orden)
CREATE POLICY "Assigned therapist can create initial evaluation"
ON public.initial_evaluations
FOR INSERT TO authenticated
WITH CHECK (
  public.is_therapist(auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.medical_orders mo
    JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
    WHERE mo.id = initial_evaluations.medical_order_id
    AND tp.user_id = auth.uid()
  )
);

-- Admins y terapeutas con paciente asignado pueden ver
CREATE POLICY "View initial evaluations"
ON public.initial_evaluations
FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.medical_orders mo
    WHERE mo.id = initial_evaluations.medical_order_id
    AND mo.patient_id IN (
      SELECT DISTINCT mo2.patient_id 
      FROM public.medical_orders mo2
      JOIN public.therapist_profiles tp ON mo2.therapist_id = tp.id
      WHERE tp.user_id = auth.uid()
    )
  )
);

-- No hay UPDATE policy = evaluaciones iniciales son inmutables

-- Trigger para updated_at
CREATE TRIGGER update_initial_evaluations_updated_at
BEFORE UPDATE ON public.initial_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FASE 3: ACTUALIZAR VALIDACIÓN DE EVOLUCIONES
-- Incluir bloqueo parcial por sesiones canceladas sin reprogramar
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_evolution_order()
RETURNS TRIGGER AS $$
DECLARE
  current_session_number INTEGER;
  order_id UUID;
  previous_pending INTEGER;
  canceled_not_rescheduled INTEGER;
  has_initial_eval BOOLEAN;
BEGIN
  -- Obtener número de sesión y orden
  SELECT s.numero_sesion, s.medical_order_id 
  INTO current_session_number, order_id
  FROM public.sessions s WHERE s.id = NEW.session_id;
  
  -- Si es sesión 1, verificar que exista evaluación inicial
  IF current_session_number = 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.initial_evaluations ie
      WHERE ie.medical_order_id = order_id
    ) INTO has_initial_eval;
    
    IF NOT has_initial_eval THEN
      RAISE EXCEPTION 'Debe completar la Evaluación Inicial antes de evolucionar la primera sesión.';
    END IF;
  END IF;
  
  -- Sesiones anteriores sin evolución (excluyendo canceladas y reprogramadas)
  SELECT COUNT(*) INTO previous_pending
  FROM public.sessions s
  WHERE s.medical_order_id = order_id
    AND s.numero_sesion < current_session_number
    AND s.estado NOT IN ('cancelada', 'reprogramada')
    AND NOT EXISTS (SELECT 1 FROM public.evolutions e WHERE e.session_id = s.id);
  
  -- BLOQUEO PARCIAL: Sesiones canceladas sin reprogramar (solo la inmediata anterior)
  SELECT COUNT(*) INTO canceled_not_rescheduled
  FROM public.sessions s
  WHERE s.medical_order_id = order_id
    AND s.numero_sesion = current_session_number - 1
    AND s.estado = 'cancelada'
    AND s.reprogramada_a IS NULL;
  
  IF previous_pending > 0 THEN
    RAISE EXCEPTION 'Hay % sesiones anteriores sin evolución. Complete las evoluciones pendientes primero.', previous_pending;
  END IF;
  
  IF canceled_not_rescheduled > 0 THEN
    RAISE EXCEPTION 'La sesión anterior está cancelada y pendiente de reprogramar. Reprograme la sesión antes de continuar.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;