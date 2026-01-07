-- Add domiciliary rates to therapist_rates table
ALTER TABLE public.therapist_rates 
  ADD COLUMN IF NOT EXISTS valor_sesion_domiciliaria NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_hora_domiciliaria NUMERIC(12,2);

-- Create enum for payroll period status
DO $$ BEGIN
  CREATE TYPE public.estado_periodo AS ENUM ('abierto', 'cerrado', 'pagado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create payroll_periods table
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL CHECK (anio >= 2020),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado estado_periodo DEFAULT 'abierto' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  paid_at TIMESTAMPTZ,
  notas TEXT,
  UNIQUE(mes, anio)
);

-- Enable RLS on payroll_periods
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

-- RLS policies for payroll_periods
CREATE POLICY "Admins can manage payroll periods" 
ON public.payroll_periods 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create payroll_details table
CREATE TABLE IF NOT EXISTS public.payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.therapist_profiles(id) NOT NULL,
  
  -- Conteos
  sesiones_intramural INTEGER DEFAULT 0 NOT NULL,
  sesiones_domiciliaria INTEGER DEFAULT 0 NOT NULL,
  horas_intramural NUMERIC(10,2) DEFAULT 0 NOT NULL,
  horas_domiciliaria NUMERIC(10,2) DEFAULT 0 NOT NULL,
  
  -- Valores aplicados (snapshot de tarifas al momento del cálculo)
  tarifa_sesion_intramural NUMERIC(12,2),
  tarifa_sesion_domiciliaria NUMERIC(12,2),
  tarifa_hora_intramural NUMERIC(12,2),
  tarifa_hora_domiciliaria NUMERIC(12,2),
  es_por_hora BOOLEAN DEFAULT false NOT NULL,
  
  -- Totales calculados
  subtotal_intramural NUMERIC(12,2) DEFAULT 0 NOT NULL,
  subtotal_domiciliaria NUMERIC(12,2) DEFAULT 0 NOT NULL,
  total_bruto NUMERIC(12,2) DEFAULT 0 NOT NULL,
  
  -- Notas
  notas TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(period_id, therapist_id)
);

-- Enable RLS on payroll_details
ALTER TABLE public.payroll_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for payroll_details
CREATE POLICY "Admins can manage payroll details" 
ON public.payroll_details 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Therapists can view their own payroll details" 
ON public.payroll_details 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.therapist_profiles tp
    WHERE tp.id = payroll_details.therapist_id 
    AND tp.user_id = auth.uid()
  )
);

-- Add trigger for updated_at on payroll_details
CREATE TRIGGER update_payroll_details_updated_at
BEFORE UPDATE ON public.payroll_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();