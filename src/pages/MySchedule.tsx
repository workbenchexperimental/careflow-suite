import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Home,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { format, addDays, startOfDay, isToday, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { TherapistProfile, ESTADO_SESION_LABELS, EstadoSesion, UBICACION_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import SessionDetailDialog from '@/components/schedule/SessionDetailDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionWithRelations {
  id: string;
  numero_sesion: number;
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string | null;
  estado: string;
  ubicacion: string;
  medical_order_id: string;
  medical_orders: {
    id: string;
    especialidad: string;
    diagnostico: string | null;
    total_sesiones: number;
    patients: { 
      id: string;
      nombre_completo: string;
      telefono: string | null;
      direccion: string | null;
    } | null;
  } | null;
}

export default function MySchedule() {
  const { profile } = useAuth();
  const therapistProfile = profile as TherapistProfile;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('hoy');

  const { data: sessions, isLoading, refetch } = useQuery({
    queryKey: ['my-sessions', therapistProfile?.id],
    queryFn: async () => {
      if (!therapistProfile?.id) return [];
      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          medical_orders!inner (
            id,
            especialidad,
            diagnostico,
            total_sesiones,
            therapist_id,
            patients (
              id,
              nombre_completo,
              telefono,
              direccion
            )
          )
        `)
        .eq('medical_orders.therapist_id', therapistProfile.id)
        .order('fecha_programada', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) throw error;
      return data as SessionWithRelations[];
    },
    enabled: !!therapistProfile?.id,
  });

  const previousDay = () => setCurrentDate(addDays(currentDate, -1));
  const nextDay = () => setCurrentDate(addDays(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const todaySessions = sessions?.filter(s => 
    isToday(new Date(s.fecha_programada))
  ) || [];

  const pendingSessions = sessions?.filter(s => 
    s.estado === 'programada' && 
    (isToday(new Date(s.fecha_programada)) || isAfter(new Date(s.fecha_programada), new Date()))
  ) || [];

  const cancelledSessions = sessions?.filter(s => 
    s.estado === 'cancelada'
  ) || [];

  const selectedDaySessions = sessions?.filter(s => 
    format(new Date(s.fecha_programada), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
  ) || [];

  const getEstadoBadgeClass = (estado: EstadoSesion) => {
    const classes: Record<EstadoSesion, string> = {
      programada: 'badge-programada',
      completada: 'badge-completada',
      cancelada: 'badge-cancelada',
      reprogramada: 'badge-reprogramada',
      plan_casero: 'badge-plan-casero',
    };
    return classes[estado];
  };

  const SessionCard = ({ session }: { session: SessionWithRelations }) => (
    <Card 
      className="card-clinical cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedSession(session.id)}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                {session.medical_orders?.patients?.nombre_completo}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(session.fecha_programada), "d 'de' MMM", { locale: es })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.hora_inicio}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {UBICACION_LABELS[session.ubicacion as 'intramural' | 'domiciliaria']}
              </span>
            </div>
            {session.ubicacion === 'domiciliaria' && session.medical_orders?.patients?.direccion && (
              <p className="text-xs text-muted-foreground">
                📍 {session.medical_orders.patients.direccion}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`badge-session ${getEstadoBadgeClass(session.estado as EstadoSesion)}`}>
              {ESTADO_SESION_LABELS[session.estado as EstadoSesion]}
            </span>
            <span className="text-xs text-muted-foreground">
              Sesión {session.numero_sesion}/{session.medical_orders?.total_sesiones}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi Agenda</h1>
        <p className="text-muted-foreground">
          Gestión de sus sesiones y pacientes asignados
        </p>
      </div>

      {/* Tabs de navegación */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hoy" className="gap-2">
            <Calendar className="h-4 w-4" />
            Hoy
            {todaySessions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {todaySessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendario">
            <Calendar className="h-4 w-4 mr-2" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="pendientes">
            <Clock className="h-4 w-4 mr-2" />
            Pendientes
            {pendingSessions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reprogramar">
            <XCircle className="h-4 w-4 mr-2" />
            Por Reprogramar
            {cancelledSessions.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {cancelledSessions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Hoy */}
        <TabsContent value="hoy" className="space-y-4">
          {todaySessions.length > 0 ? (
            <div className="space-y-3">
              {todaySessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <Card className="card-clinical">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No tiene sesiones programadas para hoy</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Calendario */}
        <TabsContent value="calendario" className="space-y-4">
          <Card className="card-clinical">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={previousDay}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={nextDay}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={goToToday}>
                    Hoy
                  </Button>
                </div>
                <div className="text-lg font-semibold">
                  {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDaySessions.length > 0 ? (
            <div className="space-y-3">
              {selectedDaySessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <Card className="card-clinical">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  No tiene sesiones programadas para este día
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Pendientes */}
        <TabsContent value="pendientes" className="space-y-4">
          {pendingSessions.length > 0 ? (
            <div className="space-y-3">
              {pendingSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          ) : (
            <Card className="card-clinical">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-success/50 mb-3" />
                <p className="text-muted-foreground">No tiene sesiones pendientes</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Por Reprogramar */}
        <TabsContent value="reprogramar" className="space-y-4">
          {cancelledSessions.length > 0 ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Estas sesiones fueron canceladas y requieren reprogramación por el administrador.
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                {cancelledSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            </>
          ) : (
            <Card className="card-clinical">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-success/50 mb-3" />
                <p className="text-muted-foreground">No hay sesiones por reprogramar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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