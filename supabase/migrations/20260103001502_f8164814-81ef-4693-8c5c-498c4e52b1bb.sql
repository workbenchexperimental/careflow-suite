-- 1. Agregar campos para reprogramación de sesiones
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reprogramada_de uuid REFERENCES sessions(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reprogramada_a uuid REFERENCES sessions(id);

-- 2. Bloquear UPDATE de órdenes médicas - solo lectura después de creación
DROP POLICY IF EXISTS "Admins can manage all medical orders" ON medical_orders;

CREATE POLICY "Admins can create medical orders" ON medical_orders
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can view all medical orders" ON medical_orders
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Modificar política de sesiones - solo terapeutas asignados pueden cambiar estado
DROP POLICY IF EXISTS "Therapists can update their own sessions" ON sessions;

CREATE POLICY "Therapists can update session status" ON sessions
  FOR UPDATE TO authenticated
  USING (
    is_therapist(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE mo.id = sessions.medical_order_id
      AND tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_therapist(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN therapist_profiles tp ON mo.therapist_id = tp.id
      WHERE mo.id = sessions.medical_order_id
      AND tp.user_id = auth.uid()
    )
  );

-- 4. Permitir a admin INSERT en sessions (para reprogramar)
DROP POLICY IF EXISTS "Admins can manage all sessions" ON sessions;

CREATE POLICY "Admins can view all sessions" ON sessions
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- 5. Permitir admin UPDATE solo para reprogramar (vincular sesiones)
CREATE POLICY "Admins can update session for rescheduling" ON sessions
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));