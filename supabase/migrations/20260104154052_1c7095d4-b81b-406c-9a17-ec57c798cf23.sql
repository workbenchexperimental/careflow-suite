-- Agregar campos codigo_orden y grupo_orden a medical_orders
ALTER TABLE public.medical_orders 
ADD COLUMN IF NOT EXISTS codigo_orden VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS grupo_orden VARCHAR(20);

-- Crear secuencia para códigos de orden
CREATE SEQUENCE IF NOT EXISTS medical_order_code_seq START 1;

-- Función para generar código único de orden
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_orden IS NULL THEN
    NEW.codigo_orden := 'OM-' || TO_CHAR(NOW(), 'YYMM') || '-' || 
      LPAD(CAST(NEXTVAL('medical_order_code_seq') AS VARCHAR), 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para generar código automáticamente
DROP TRIGGER IF EXISTS set_order_code ON public.medical_orders;
CREATE TRIGGER set_order_code 
  BEFORE INSERT ON public.medical_orders 
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_code();

-- Actualizar órdenes existentes con código
UPDATE public.medical_orders 
SET codigo_orden = 'OM-' || TO_CHAR(created_at, 'YYMM') || '-' || LPAD(CAST(id::text AS VARCHAR), 4, '0')
WHERE codigo_orden IS NULL;

-- Tabla para historial de transferencias
CREATE TABLE IF NOT EXISTS public.order_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_order_id UUID REFERENCES public.medical_orders(id) ON DELETE CASCADE NOT NULL,
  from_therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  to_therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  motivo TEXT NOT NULL,
  transferred_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar RLS en order_transfers
ALTER TABLE public.order_transfers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para order_transfers
CREATE POLICY "Admins can manage transfers" ON public.order_transfers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Therapists can view their transfers" ON public.order_transfers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.therapist_profiles tp
      WHERE (tp.id = order_transfers.from_therapist_id OR tp.id = order_transfers.to_therapist_id)
      AND tp.user_id = auth.uid()
    )
  );

-- Función para validar orden secuencial de evoluciones
CREATE OR REPLACE FUNCTION public.validate_evolution_order()
RETURNS TRIGGER AS $$
DECLARE
  current_session_number INTEGER;
  order_id UUID;
  previous_sessions_without_evolution INTEGER;
BEGIN
  -- Obtener número de sesión y orden
  SELECT s.numero_sesion, s.medical_order_id 
  INTO current_session_number, order_id
  FROM public.sessions s WHERE s.id = NEW.session_id;
  
  -- Contar sesiones anteriores sin evolución (excluyendo canceladas y reprogramadas)
  SELECT COUNT(*) INTO previous_sessions_without_evolution
  FROM public.sessions s
  WHERE s.medical_order_id = order_id
    AND s.numero_sesion < current_session_number
    AND s.estado NOT IN ('cancelada', 'reprogramada')
    AND NOT EXISTS (
      SELECT 1 FROM public.evolutions e WHERE e.session_id = s.id
    );
  
  IF previous_sessions_without_evolution > 0 THEN
    RAISE EXCEPTION 'Debe completar las evoluciones de las sesiones anteriores primero. Hay % sesiones pendientes.', previous_sessions_without_evolution;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para validar orden de evoluciones
DROP TRIGGER IF EXISTS check_evolution_order ON public.evolutions;
CREATE TRIGGER check_evolution_order
  BEFORE INSERT ON public.evolutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_evolution_order();

-- Actualizar RLS de evolutions para solo terapeutas asignados
DROP POLICY IF EXISTS "Therapists can create their own evolutions" ON public.evolutions;
CREATE POLICY "Only assigned therapists can create evolutions" ON public.evolutions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_therapist(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE s.id = evolutions.session_id
      AND tp.user_id = auth.uid()
    )
  );

-- Actualizar política de edición - solo terapeuta asignado dentro de 24h
DROP POLICY IF EXISTS "Therapists can update their own evolutions if not locked" ON public.evolutions;
CREATE POLICY "Assigned therapists can update within 24h" ON public.evolutions
  FOR UPDATE TO authenticated
  USING (
    bloqueado = false AND
    created_at > (NOW() - INTERVAL '24 hours') AND
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE s.id = evolutions.session_id
      AND tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      JOIN public.therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE s.id = evolutions.session_id
      AND tp.user_id = auth.uid()
    )
  );

-- Actualizar política de lectura - todos los terapeutas pueden ver evoluciones de pacientes compartidos
DROP POLICY IF EXISTS "Therapists can view evolutions of their patients" ON public.evolutions;
CREATE POLICY "Therapists can view all patient evolutions" ON public.evolutions
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.medical_orders mo ON s.medical_order_id = mo.id
      WHERE s.id = evolutions.session_id
      AND mo.patient_id IN (
        SELECT DISTINCT mo2.patient_id 
        FROM public.medical_orders mo2
        JOIN public.therapist_profiles tp ON mo2.therapist_id = tp.id
        WHERE tp.user_id = auth.uid()
      )
    )
  );

-- Índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_medical_orders_codigo ON public.medical_orders(codigo_orden);
CREATE INDEX IF NOT EXISTS idx_medical_orders_grupo ON public.medical_orders(grupo_orden);
CREATE INDEX IF NOT EXISTS idx_order_transfers_order ON public.order_transfers(medical_order_id);