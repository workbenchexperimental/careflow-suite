-- Crear política para permitir que admins actualicen medical_orders (para transferencias)
CREATE POLICY "Admins can update medical orders for transfers" ON public.medical_orders
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));