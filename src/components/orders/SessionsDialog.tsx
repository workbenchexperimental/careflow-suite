import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, estado }: { sessionId: string; estado: EstadoSesion }) => {
      const { error } = await supabase
        .from('sessions')
        .update({ estado })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', orderId] });
      queryClient.invalidateQueries({ queryKey: ['medical-orders'] });
      toast({
        title: 'Sesión actualizada',
        description: 'El estado de la sesión ha sido actualizado',
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
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

  return (
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
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`badge-session ${getEstadoBadgeClass(session.estado as EstadoSesion)}`}>
                      {estadoIcons[session.estado as EstadoSesion]}
                      <span className="ml-1">{ESTADO_SESION_LABELS[session.estado as EstadoSesion]}</span>
                    </span>

                    {session.estado === 'programada' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Cambiar estado
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => updateSessionMutation.mutate({ 
                              sessionId: session.id, 
                              estado: 'completada' 
                            })}
                          >
                            <CheckCircle className="mr-2 h-4 w-4 text-success" />
                            Marcar Completada
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateSessionMutation.mutate({ 
                              sessionId: session.id, 
                              estado: 'cancelada' 
                            })}
                          >
                            <XCircle className="mr-2 h-4 w-4 text-destructive" />
                            Cancelar Sesión
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateSessionMutation.mutate({ 
                              sessionId: session.id, 
                              estado: 'plan_casero' 
                            })}
                          >
                            <Home className="mr-2 h-4 w-4 text-session-plan-casero" />
                            Plan Casero
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
  );
}