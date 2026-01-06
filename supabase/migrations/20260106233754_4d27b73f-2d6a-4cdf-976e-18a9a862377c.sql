-- 1. Modificar trigger generate_order_code para que solo genere si no viene código
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  -- Solo generar código automático si no viene uno proporcionado
  IF NEW.codigo_orden IS NULL OR NEW.codigo_orden = '' THEN
    NEW.codigo_orden := 'OM-' || TO_CHAR(NOW(), 'YYMM') || '-' || 
      LPAD(CAST(NEXTVAL('medical_order_code_seq') AS VARCHAR), 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Actualizar validate_evolution_order para usar validación por FECHAS en vez de números
CREATE OR REPLACE FUNCTION public.validate_evolution_order()
RETURNS TRIGGER AS $$
DECLARE
  current_session_id UUID;
  current_session_date DATE;
  current_session_time TIME;
  order_id UUID;
  previous_pending INTEGER;
  blocking_canceled INTEGER;
  has_initial_eval BOOLEAN;
  current_session_number INTEGER;
BEGIN
  current_session_id := NEW.session_id;
  
  -- Obtener datos de la sesión actual
  SELECT s.numero_sesion, s.medical_order_id, s.fecha_programada, s.hora_inicio 
  INTO current_session_number, order_id, current_session_date, current_session_time
  FROM public.sessions s WHERE s.id = current_session_id;
  
  -- Si es sesión 1 (por número), verificar evaluación inicial
  IF current_session_number = 1 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.initial_evaluations ie
      WHERE ie.medical_order_id = order_id
    ) INTO has_initial_eval;
    
    IF NOT has_initial_eval THEN
      RAISE EXCEPTION 'Debe completar la Evaluación Inicial antes de evolucionar la primera sesión.';
    END IF;
  END IF;
  
  -- Sesiones anteriores sin evolución (por FECHA, no número)
  -- Excluir canceladas y reprogramadas
  SELECT COUNT(*) INTO previous_pending
  FROM public.sessions s
  WHERE s.medical_order_id = order_id
    AND s.id != current_session_id
    AND (s.fecha_programada < current_session_date 
         OR (s.fecha_programada = current_session_date AND s.hora_inicio < current_session_time))
    AND s.estado NOT IN ('cancelada', 'reprogramada')
    AND NOT EXISTS (SELECT 1 FROM public.evolutions e WHERE e.session_id = s.id);
  
  -- Sesiones canceladas sin reprogramar que bloquean
  -- (solo las que tienen fecha ANTERIOR a la actual Y no han sido reprogramadas)
  SELECT COUNT(*) INTO blocking_canceled
  FROM public.sessions s
  WHERE s.medical_order_id = order_id
    AND s.id != current_session_id
    AND (s.fecha_programada < current_session_date 
         OR (s.fecha_programada = current_session_date AND s.hora_inicio < current_session_time))
    AND s.estado = 'cancelada'
    AND s.reprogramada_a IS NULL;
  
  IF previous_pending > 0 THEN
    RAISE EXCEPTION 'Hay % sesiones anteriores (por fecha) sin evolución. Complete las evoluciones pendientes primero.', previous_pending;
  END IF;
  
  IF blocking_canceled > 0 THEN
    RAISE EXCEPTION 'Hay % sesiones canceladas anteriores pendientes de reprogramar.', blocking_canceled;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;