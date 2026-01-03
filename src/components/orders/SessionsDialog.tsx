import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Home,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ESTADO_SESION_LABELS, EstadoSesion, UBICACION_LABELS } from '@/types/database';
import RescheduleSessionDialog from '@/components/schedule/RescheduleSessionDialog';

interface SessionsDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess?: () => void;
}

const estadoIcons: Record<EstadoSesion, React.ReactNode> = {
  programada: <Clock className="h-4 w-4" />,
  completada: <CheckCircle className="h-4 w-4" />,
  cancelada: <XCircle className="h-4 w-4" />,
  reprogramada: <RefreshCw className="h-4 w-4" />,
  plan_casero: <Home className="h-4 w-4" />,
};

export default function SessionsDialog({
  open,
  onClose,
  orderId,
  onSuccess,
}: SessionsDialogProps) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [rescheduleSession, setRescheduleSession] = useState<{
    id: string;
    numero_sesion: number;
    medical_order_id: string;
    ubicacion: string;
    notas_cancelacion?: string | null;
  } | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('medical_order_id', orderId)
        .order('numero_sesion', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  const { data: order } = useQuery({
    queryKey: ['medical-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          *,
          patients (nombre_completo),
          therapist_profiles (nombre_completo)
        `)
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

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

  const handleRescheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sessions', orderId] });
    queryClient.invalidateQueries({ queryKey: ['medical-orders'] });
    onSuccess?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Sesiones de la Orden
            </DialogTitle>
            {order && (
              <DialogDescription>
                Paciente: {order.patients?.nombre_completo} | 
                Terapeuta: {order.therapist_profiles?.nombre_completo}
              </DialogDescription>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-150px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div className="space-y-3 pr-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
                        {session.numero_sesion}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(session.fecha_programada), "EEEE, d 'de' MMMM", { locale: es })}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.hora_inicio}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {UBICACION_LABELS[session.ubicacion as 'intramural' | 'domiciliaria']}
                          </span>
                        </div>
                        {session.notas_cancelacion && (
                          <p className="text-xs text-destructive mt-1">
                            Motivo: {session.notas_cancelacion}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`badge-session ${getEstadoBadgeClass(session.estado as EstadoSesion)}`}>
                        {estadoIcons[session.estado as EstadoSesion]}
                        <span className="ml-1">{ESTADO_SESION_LABELS[session.estado as EstadoSesion]}</span>
                      </span>

                      {/* Solo admin puede reprogramar sesiones canceladas */}
                      {isAdmin && session.estado === 'cancelada' && !session.reprogramada_a && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setRescheduleSession({
                            id: session.id,
                            numero_sesion: session.numero_sesion,
                            medical_order_id: session.medical_order_id,
                            ubicacion: session.ubicacion,
                            notas_cancelacion: session.notas_cancelacion,
                          })}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reprogramar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No hay sesiones para esta orden</p>
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de reprogramación */}
      <RescheduleSessionDialog
        open={!!rescheduleSession}
        onClose={() => setRescheduleSession(null)}
        session={rescheduleSession}
        onSuccess={handleRescheduleSuccess}
      />
    </>
  );
}