// Tipos personalizados para el ERP Clínico
// Complementan los tipos auto-generados de Supabase

export type AppRole = 'admin' | 'terapeuta';

export type Especialidad = 
  | 'fisioterapia'
  | 'fonoaudiologia'
  | 'terapia_ocupacional'
  | 'psicologia'
  | 'terapia_acuatica';

export type EstadoOrden = 'activa' | 'cerrada';

export type EstadoSesion = 
  | 'programada'
  | 'completada'
  | 'cancelada'
  | 'reprogramada'
  | 'plan_casero';

export type UbicacionSesion = 'intramural' | 'domiciliaria';

export type Sexo = 'masculino' | 'femenino' | 'otro';

// Mapeo de especialidades a labels legibles
export const ESPECIALIDAD_LABELS: Record<Especialidad, string> = {
  fisioterapia: 'Fisioterapia',
  fonoaudiologia: 'Fonoaudiología',
  terapia_ocupacional: 'Terapia Ocupacional',
  psicologia: 'Psicología',
  terapia_acuatica: 'Terapia Acuática',
};

// Mapeo de estados de sesión a labels
export const ESTADO_SESION_LABELS: Record<EstadoSesion, string> = {
  programada: 'Programada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  reprogramada: 'Reprogramada',
  plan_casero: 'Plan Casero',
};

// Mapeo de ubicaciones
export const UBICACION_LABELS: Record<UbicacionSesion, string> = {
  intramural: 'Intramural',
  domiciliaria: 'Domiciliaria',
};

// Especialidades permitidas por ubicación
export const ESPECIALIDADES_DOMICILIARIAS: Especialidad[] = [
  'fisioterapia',
  'fonoaudiologia',
  'terapia_ocupacional',
];

// Interfaz para el usuario autenticado con su rol y perfil
export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  profile: TherapistProfile | AdminProfile | null;
}

export interface TherapistProfile {
  id: string;
  user_id: string;
  cedula: string;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  especialidad: Especialidad;
  firma_digital_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  cedula: string;
  nombre_completo: string;
  email: string;
  telefono: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface Patient {
  id: string;
  nombre_completo: string;
  cedula: string | null;
  sexo: Sexo;
  fecha_nacimiento: string;
  ciudad: string | null;
  direccion: string | null;
  eps: string | null;
  ocupacion: string | null;
  telefono: string | null;
  email: string | null;
  acudiente_nombre: string;
  acudiente_telefono: string;
  acudiente_parentesco: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Función helper para calcular edad
export function calcularEdad(fechaNacimiento: string): { años: number; meses: number } {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  
  let años = hoy.getFullYear() - nacimiento.getFullYear();
  let meses = hoy.getMonth() - nacimiento.getMonth();
  
  if (meses < 0 || (meses === 0 && hoy.getDate() < nacimiento.getDate())) {
    años--;
    meses += 12;
  }
  
  if (hoy.getDate() < nacimiento.getDate()) {
    meses--;
    if (meses < 0) meses = 11;
  }
  
  return { años, meses };
}

// Función para formatear edad
export function formatearEdad(fechaNacimiento: string): string {
  const { años, meses } = calcularEdad(fechaNacimiento);
  
  if (años === 0) {
    return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  }
  
  if (meses === 0) {
    return `${años} ${años === 1 ? 'año' : 'años'}`;
  }
  
  return `${años} ${años === 1 ? 'año' : 'años'} y ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}