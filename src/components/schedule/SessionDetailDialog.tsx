import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Clock, 
  User,
  MapPin,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Home,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ESTADO_SESION_LABELS, 
  EstadoSesion, 
  UBICACION_LABELS, 
  ESPECIALIDAD_LABELS, 
  Especialidad,
  TherapistProfile,
  formatearEdad 
} from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EvolutionFormDialog from '@/components/evolutions/EvolutionFormDialog';

interface SessionDetailDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSuccess?: () => void;
}

export default function SessionDetailDialog({
  open,
  onClose,
  sessionId,
  onSuccess,
}: SessionDetailDialogProps) {
  const { toast } = useToast();
  const { isTherapist, isAdmin, profile } = useAuth();
  const queryClient = useQueryClient();
  const [cancelNotes, setCancelNotes] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showEvolutionForm, setShowEvolutionForm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EstadoSesion | null>(null);

  const therapistProfile = isTherapist ? (profile as TherapistProfile) : null;

  const { data: session, isLoading } = useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          medical_orders (
            id,
            especialidad,
            diagnostico,
            total_sesiones,
            sesiones_completadas,
            ubicacion,
            patients (
              id,
              nombre_completo,
              cedula,
              fecha_nacimiento,
              telefono,
              direccion,
              acudiente_nombre,
              acudiente_telefono
            ),
            therapist_profiles (
              id,
              nombre_completo,
              especialidad
            )
          )
        `)
        .eq('id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Verificar si es la primera o última sesión
  const { data: allSessions } = useQuery({
    queryKey: ['order-sessions', session?.medical_order_id],
    queryFn: async () => {
      if (!session?.medical_order_id) return [];
      const { data, error } = await supabase
        .from('sessions')
        .select('id, numero_sesion, estado')
        .eq('medical_order_id', session.medical_order_id)
        .order('numero_sesion', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.medical_order_id,
  });

  const isFirstSession = session?.numero_sesion === 1;
  const isLastSession = session?.numero_sesion === session?.medical_orders?.total_sesiones;
  
  // Verificar continuidad para Plan Casero
  const previousSession = allSessions?.find(s => s.numero_sesion === (session?.numero_sesion || 0) - 1);
  const canUsePlanCasero = !isFirstSession && !isLastSession && 
    previousSession && ['completada', 'plan_casero'].includes(previousSession.estado);

  const updateSessionMutation = useMutation({
    mutationFn: async ({ estado, notas }: { estado: EstadoSesion; notas?: string }) => {
      const updateData: any = { estado };
      if (notas) updateData.notas_cancelacion = notas;

      const { error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-detail', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['canceled-sessions'] });
      toast({
        title: 'Sesión actualizada',
        description: 'El estado de la sesión ha sido actualizado',
      });
      setShowCancelForm(false);
      setCancelNotes('');
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

  const handleStatusChange = (estado: EstadoSesion) => {
    if (estado === 'cancelada') {
      setShowCancelForm(true);
    } else if (estado === 'completada' || estado === 'plan_casero') {
      // Para completada y plan_casero, primero hay que hacer la evolución
      setPendingStatus(estado);
      setShowEvolutionForm(true);
    } else {
      updateSessionMutation.mutate({ estado });
    }
  };

  const handleCancelWithNotes = () => {
    updateSessionMutation.mutate({ 
      estado: 'cancelada', 
      notas: cancelNotes 
    });
  };

  const handleEvolutionSuccess = () => {
    // Después de guardar la evolución, actualizar el estado de la sesión
    if (pendingStatus) {
      updateSessionMutation.mutate({ estado: pendingStatus });
    }
    setShowEvolutionForm(false);
    setPendingStatus(null);
  };

  const handleEvolutionClose = () => {
    setShowEvolutionForm(false);
    setPendingStatus(null);
  };

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

  if (!session) return null;

  const patient = session.medical_orders?.patients;
  const therapist = session.medical_orders?.therapist_profiles;
  
  // SOLO el terapeuta asignado puede cambiar el estado (NO el admin)
  const canChangeStatus = session.estado === 'programada' && 
    isTherapist && therapistProfile?.id === therapist?.id;

  return (
    <>
      <Dialog open={open && !showEvolutionForm} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Detalle de Sesión #{session.numero_sesion}
            </DialogTitle>
            <DialogDescription>
              {format(new Date(session.fecha_programada), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Estado actual */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado:</span>
              <span className={`badge-session ${getEstadoBadgeClass(session.estado as EstadoSesion)}`}>
                {ESTADO_SESION_LABELS[session.estado as EstadoSesion]}
              </span>
            </div>

            <Separator />

            {/* Info de la sesión */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Hora: {session.hora_inicio}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{UBICACION_LABELS[session.ubicacion as 'intramural' | 'domiciliaria']}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span>{ESPECIALIDAD_LABELS[session.medical_orders?.especialidad as Especialidad]}</span>
              </div>
            </div>

            <Separator />

            {/* Datos del paciente */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Paciente
              </h4>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                <p className="font-medium">{patient?.nombre_completo}</p>
                {patient?.fecha_nacimiento && (
                  <p className="text-muted-foreground">
                    Edad: {formatearEdad(patient.fecha_nacimiento)}
                  </p>
                )}
                {patient?.telefono && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    {patient.telefono}
                  </p>
                )}
                {session.ubicacion === 'domiciliaria' && patient?.direccion && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {patient.direccion}
                  </p>
                )}
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  Acudiente: {patient?.acudiente_nombre} - {patient?.acudiente_telefono}
                </p>
              </div>
            </div>

            {/* Diagnóstico */}
            {session.medical_orders?.diagnostico && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Diagnóstico
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {session.medical_orders.diagnostico}
                  </p>
                </div>
              </>
            )}

            {/* Mensaje para admin */}
            {isAdmin && session.estado === 'programada' && (
              <>
                <Separator />
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Solo el terapeuta asignado puede cambiar el estado de las sesiones.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {/* Acciones de cambio de estado - SOLO TERAPEUTA ASIGNADO */}
            {canChangeStatus && (
              <>
                <Separator />
                
                {showCancelForm ? (
                  <div className="space-y-4">
                    <Label>Motivo de cancelación</Label>
                    <Textarea
                      placeholder="Ingrese el motivo de la cancelación..."
                      value={cancelNotes}
                      onChange={(e) => setCancelNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCancelForm(false)}
                        className="flex-1"
                      >
                        Volver
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={handleCancelWithNotes}
                        disabled={updateSessionMutation.isPending}
                        className="flex-1"
                      >
                        Confirmar Cancelación
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Cambiar Estado</h4>
                    <Alert className="bg-primary/10 border-primary/20">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-primary">
                        Al marcar como Completada o Plan Casero, deberá registrar la evolución clínica.
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="gap-2 border-success text-success hover:bg-success hover:text-success-foreground"
                        onClick={() => handleStatusChange('completada')}
                        disabled={updateSessionMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Completada
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleStatusChange('cancelada')}
                        disabled={updateSessionMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>

                    {/* Plan Casero con validaciones */}
                    {isFirstSession && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          La primera sesión requiere Evaluación Inicial. No se puede marcar como Plan Casero.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {isLastSession && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          La última sesión requiere cierre formal. No se puede marcar como Plan Casero.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isFirstSession && !isLastSession && !canUsePlanCasero && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Para usar Plan Casero, la sesión anterior debe estar Completada o ser Plan Casero.
                        </AlertDescription>
                      </Alert>
                    )}

                    {canUsePlanCasero && (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handleStatusChange('plan_casero')}
                        disabled={updateSessionMutation.isPending}
                      >
                        <Home className="h-4 w-4" />
                        Marcar como Plan Casero
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Notas de cancelación */}
            {session.notas_cancelacion && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-destructive">
                    Motivo de Cancelación
                  </h4>
                  <p className="text-sm text-muted-foreground bg-destructive/10 p-3 rounded-lg">
                    {session.notas_cancelacion}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de evolución obligatoria */}
      <EvolutionFormDialog
        open={showEvolutionForm}
        onClose={handleEvolutionClose}
        sessionId={sessionId}
        onSuccess={handleEvolutionSuccess}
      />
    </>
  );
}