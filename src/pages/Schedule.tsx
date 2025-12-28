import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  Stethoscope,
  MapPin,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ESPECIALIDAD_LABELS, Especialidad, ESTADO_SESION_LABELS, EstadoSesion, UBICACION_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import SessionDetailDialog from '@/components/schedule/SessionDetailDialog';

interface SessionWithRelations {
  id: string;
  numero_sesion: number;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string | null;
  estado: string;
  ubicacion: string;
  medical_orders: {
    id: string;
    especialidad: string;
    diagnostico: string | null;
    patients: { nombre_completo: string } | null;
    therapist_profiles: { nombre_completo: string } | null;
  } | null;
}

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['schedule-sessions', format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          medical_orders (
            id,
            especialidad,
            diagnostico,
            patients (nombre_completo),
            therapist_profiles (nombre_completo)
          )
        `)
        .gte('fecha_programada', format(weekStart, 'yyyy-MM-dd'))
        .lte('fecha_programada', format(weekEnd, 'yyyy-MM-dd'))
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
      return data as SessionWithRelations[];
    },
  });

  const previousWeek = () => setCurrentDate(addDays(currentDate, -7));
  const nextWeek = () => setCurrentDate(addDays(currentDate, 7));
  const goToToday = () => setCurrentDate(new Date());

  const getSessionsForDay = (day: Date) => {
    return sessions?.filter(session => 
      isSameDay(new Date(session.fecha_programada), day)
    ) || [];
  };

  const getEstadoBadgeClass = (estado: EstadoSesion) => {
    const classes: Record<EstadoSesion, string> = {
      programada: 'bg-session-programada/20 border-session-programada text-session-programada',
      completada: 'bg-session-completada/20 border-session-completada text-session-completada',
      cancelada: 'bg-session-cancelada/20 border-session-cancelada text-session-cancelada',
      reprogramada: 'bg-session-reprogramada/20 border-session-reprogramada text-session-reprogramada',
      plan_casero: 'bg-session-plan-casero/20 border-session-plan-casero text-session-plan-casero',
    };
    return classes[estado];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda General</h1>
          <p className="text-muted-foreground">
            Vista de todas las sesiones programadas
          </p>
        </div>
      </div>

      {/* Controles de navegación */}
      <Card className="card-clinical">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Hoy
              </Button>
            </div>
            <div className="text-lg font-semibold">
              {format(weekStart, "d 'de' MMMM", { locale: es })} - {format(weekEnd, "d 'de' MMMM, yyyy", { locale: es })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de semana */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const daySessions = getSessionsForDay(day);
          const isCurrentDay = isToday(day);
          
          return (
            <Card 
              key={day.toISOString()} 
              className={cn(
                "card-clinical min-h-[200px]",
                isCurrentDay && "ring-2 ring-primary"
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className={cn(
                  "text-sm font-medium",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'EEEE', { locale: es })}
                </CardTitle>
                <CardDescription className={cn(
                  "text-2xl font-bold",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, 'd')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading ? (
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                ) : daySessions.length > 0 ? (
                  daySessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-md border text-xs transition-colors hover:opacity-80",
                        getEstadoBadgeClass(session.estado as EstadoSesion)
                      )}
                    >
                      <div className="font-medium truncate">
                        {session.medical_orders?.patients?.nombre_completo}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] opacity-80">
                        <Clock className="h-3 w-3" />
                        {session.hora_inicio}
                      </div>
                      <div className="text-[10px] opacity-70 truncate">
                        {session.medical_orders?.therapist_profiles?.nombre_completo}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Sin sesiones
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leyenda */}
      <Card className="card-clinical">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {(Object.keys(ESTADO_SESION_LABELS) as EstadoSesion[]).map((estado) => (
              <div key={estado} className="flex items-center gap-2">
                <span className={cn(
                  "w-3 h-3 rounded-full",
                  estado === 'programada' && "bg-session-programada",
                  estado === 'completada' && "bg-session-completada",
                  estado === 'cancelada' && "bg-session-cancelada",
                  estado === 'reprogramada' && "bg-session-reprogramada",
                  estado === 'plan_casero' && "bg-session-plan-casero",
                )} />
                <span className="text-sm text-muted-foreground">
                  {ESTADO_SESION_LABELS[estado]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalle de sesión */}
      <SessionDetailDialog
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        sessionId={selectedSession}
        onSuccess={refetch}
      />
    </div>
  );
}