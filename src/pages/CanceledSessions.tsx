import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  User,
  MapPin,
  RefreshCw,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ESPECIALIDAD_LABELS, Especialidad, UBICACION_LABELS } from '@/types/database';
import RescheduleSessionDialog from '@/components/schedule/RescheduleSessionDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CanceledSession {
  id: string;
  numero_sesion: number;
  fecha_programada: string;
  hora_inicio: string;
  ubicacion: string;
  notas_cancelacion: string | null;
  medical_order_id: string;
  medical_orders: {
    id: string;
    especialidad: string;
    total_sesiones: number;
    patients: { nombre_completo: string } | null;
    therapist_profiles: { nombre_completo: string } | null;
  } | null;
}

export default function CanceledSessions() {
  const queryClient = useQueryClient();
  const [rescheduleSession, setRescheduleSession] = useState<{
    id: string;
    numero_sesion: number;
    medical_order_id: string;
    ubicacion: string;
    notas_cancelacion?: string | null;
  } | null>(null);

  const { data: canceledSessions, isLoading } = useQuery({
    queryKey: ['canceled-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          medical_orders (
            id,
            especialidad,
            total_sesiones,
            patients (nombre_completo),
            therapist_profiles (nombre_completo)
          )
        `)
        .eq('estado', 'cancelada')
        .is('reprogramada_a', null)
        .order('fecha_programada', { ascending: false });

      if (error) throw error;
      return data as CanceledSession[];
    },
  });

  const handleRescheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['canceled-sessions'] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sesiones Canceladas</h1>
          <p className="text-muted-foreground">
            Gestione las sesiones canceladas pendientes de reprogramación
          </p>
        </div>
      </div>

      {/* Alerta informativa */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Las sesiones canceladas deben ser reprogramadas para completar el paquete del paciente.
          Al reprogramar, se crea una nueva sesión en la fecha seleccionada.
        </AlertDescription>
      </Alert>

      {/* Lista de sesiones canceladas */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Pendientes de Reprogramación
          </CardTitle>
          <CardDescription>
            {canceledSessions?.length || 0} sesiones canceladas sin reprogramar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : canceledSessions && canceledSessions.length > 0 ? (
            <div className="space-y-4">
              {canceledSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {session.medical_orders?.patients?.nombre_completo}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        - Sesión #{session.numero_sesion} de {session.medical_orders?.total_sesiones}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(session.fecha_programada), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {session.hora_inicio}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {UBICACION_LABELS[session.ubicacion as 'intramural' | 'domiciliaria']}
                      </span>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Terapeuta: </span>
                      <span>{session.medical_orders?.therapist_profiles?.nombre_completo}</span>
                      <span className="text-muted-foreground ml-2">
                        ({ESPECIALIDAD_LABELS[session.medical_orders?.especialidad as Especialidad]})
                      </span>
                    </div>

                    {session.notas_cancelacion && (
                      <div className="text-sm bg-destructive/10 p-2 rounded">
                        <span className="font-medium text-destructive">Motivo: </span>
                        <span className="text-muted-foreground">{session.notas_cancelacion}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => setRescheduleSession({
                      id: session.id,
                      numero_sesion: session.numero_sesion,
                      medical_order_id: session.medical_order_id,
                      ubicacion: session.ubicacion,
                      notas_cancelacion: session.notas_cancelacion,
                    })}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reprogramar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No hay sesiones canceladas pendientes</p>
              <p className="text-sm text-muted-foreground mt-1">
                Todas las sesiones canceladas han sido reprogramadas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de reprogramación */}
      <RescheduleSessionDialog
        open={!!rescheduleSession}
        onClose={() => setRescheduleSession(null)}
        session={rescheduleSession}
        onSuccess={handleRescheduleSuccess}
      />
    </div>
  );
}