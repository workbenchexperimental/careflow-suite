-- Crear usuario administrador inicial
-- Este script crea las entradas necesarias para el primer admin

-- Nota: El usuario debe ser creado primero via Supabase Auth
-- Aquí solo preparamos la estructura para que funcione el trigger

-- Crear función para asignar rol de admin al primer usuario con email específico
CREATE OR REPLACE FUNCTION public.assign_admin_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si es el email del admin inicial, asignar rol admin
  IF NEW.email = 'admin@clinica.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.admin_profiles (user_id, cedula, nombre_completo, email)
    VALUES (NEW.id, '0000000000', 'Administrador Principal', NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para ejecutar al crear usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_admin_on_signup();