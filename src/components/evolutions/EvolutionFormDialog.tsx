import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Lock, 
  Clock, 
  AlertTriangle,
  Save,
  Download,
  CheckCircle,
  ShieldAlert,
  ListOrdered,
} from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  TherapistProfile,
  ESPECIALIDAD_LABELS,
  Especialidad,
  formatearEdad 
} from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// Schema de validación
const evolutionSchema = z.object({
  contenido: z.string().min(10, 'El contenido debe tener al menos 10 caracteres'),
  procedimientos: z.string().optional(),
  plan_tratamiento: z.string().optional(),
  recomendaciones: z.string().optional(),
  concepto_profesional: z.string().optional(),
  evaluacion_final: z.string().optional(),
  es_cierre: z.boolean().default(false),
});

type EvolutionFormData = z.infer<typeof evolutionSchema>;

interface EvolutionFormDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSuccess?: () => void;
}

export default function EvolutionFormDialog({
  open,
  onClose,
  sessionId,
  onSuccess,
}: EvolutionFormDialogProps) {
  const { toast } = useToast();
  const { profile, isTherapist, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const therapistProfile = isTherapist ? (profile as TherapistProfile) : null;

  const form = useForm<EvolutionFormData>({
    resolver: zodResolver(evolutionSchema),
    defaultValues: {
      contenido: '',
      procedimientos: '',
      plan_tratamiento: '',
      recomendaciones: '',
      concepto_profesional: '',
      evaluacion_final: '',
      es_cierre: false,
    },
  });

  // Query para obtener datos de la sesión
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['session-evolution-detail', sessionId],
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
            codigo_orden,
            therapist_id,
            patients (
              id,
              nombre_completo,
              cedula,
              fecha_nacimiento
            ),
            therapist_profiles (
              id,
              nombre_completo,
              firma_digital_url,
              user_id
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

  // Query para obtener evolución existente
  const { data: existingEvolution, isLoading: loadingEvolution } = useQuery({
    queryKey: ['evolution', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('evolutions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Query para verificar sesiones anteriores sin evolución
  const { data: pendingPreviousSessions } = useQuery({
    queryKey: ['pending-sessions', session?.medical_order_id, session?.numero_sesion],
    queryFn: async () => {
      if (!session?.medical_order_id || !session?.numero_sesion) return [];
      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          numero_sesion,
          estado,
          evolutions(id)
        `)
        .eq('medical_order_id', session.medical_order_id)
        .lt('numero_sesion', session.numero_sesion)
        .not('estado', 'in', '("cancelada","reprogramada")');
      
      if (error) throw error;
      
      // Filter sessions without evolution
      return data?.filter(s => !s.evolutions || (Array.isArray(s.evolutions) && s.evolutions.length === 0)) || [];
    },
    enabled: !!session?.medical_order_id && !!session?.numero_sesion,
  });

  // Cargar datos existentes en el formulario
  useEffect(() => {
    if (existingEvolution) {
      form.reset({
        contenido: existingEvolution.contenido || '',
        procedimientos: existingEvolution.procedimientos || '',
        plan_tratamiento: existingEvolution.plan_tratamiento || '',
        recomendaciones: existingEvolution.recomendaciones || '',
        concepto_profesional: existingEvolution.concepto_profesional || '',
        evaluacion_final: existingEvolution.evaluacion_final || '',
        es_cierre: existingEvolution.es_cierre || false,
      });
    } else {
      form.reset({
        contenido: '',
        procedimientos: '',
        plan_tratamiento: '',
        recomendaciones: '',
        concepto_profesional: '',
        evaluacion_final: '',
        es_cierre: false,
      });
    }
  }, [existingEvolution, form]);

  // Verificar si es el terapeuta asignado
  const assignedTherapistUserId = session?.medical_orders?.therapist_profiles?.user_id;
  const currentUserId = profile?.user_id;
  const isAssignedTherapist = isTherapist && assignedTherapistUserId === currentUserId;
  
  // Verificar si está bloqueada (24 horas)
  const isLocked = existingEvolution?.bloqueado || false;
  const hoursRemaining = existingEvolution 
    ? Math.max(0, 24 - differenceInHours(new Date(), new Date(existingEvolution.created_at)))
    : 24;
  const isExpired = existingEvolution && hoursRemaining <= 0;
  
  // Can edit only if: is assigned therapist + not locked + not expired
  const canEdit = isAssignedTherapist && !isLocked && !isExpired;
  const canCreate = isAssignedTherapist && !existingEvolution && (pendingPreviousSessions?.length === 0);

  // Verificar si es la primera o última sesión
  const isFirstSession = session?.numero_sesion === 1;
  const isLastSession = session?.numero_sesion === session?.medical_orders?.total_sesiones;

  // Mutation para guardar evolución
  const saveEvolutionMutation = useMutation({
    mutationFn: async (data: EvolutionFormData) => {
      if (!sessionId || !therapistProfile?.id) {
        throw new Error('Datos incompletos');
      }

      if (!isAssignedTherapist) {
        throw new Error('Solo el terapeuta asignado puede crear o editar evoluciones');
      }

      const evolutionData = {
        session_id: sessionId,
        therapist_id: therapistProfile.id,
        contenido: data.contenido,
        procedimientos: data.procedimientos || null,
        plan_tratamiento: data.plan_tratamiento || null,
        recomendaciones: data.recomendaciones || null,
        concepto_profesional: data.concepto_profesional || null,
        evaluacion_final: data.evaluacion_final || null,
        es_cierre: data.es_cierre,
        firma_url: therapistProfile.firma_digital_url || null,
      };

      if (existingEvolution) {
        const { error } = await supabase
          .from('evolutions')
          .update(evolutionData)
          .eq('id', existingEvolution.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('evolutions')
          .insert(evolutionData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evolution', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['evolutions'] });
      toast({
        title: 'Evolución guardada',
        description: 'La evolución clínica ha sido guardada exitosamente',
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: EvolutionFormData) => {
    saveEvolutionMutation.mutate(data);
  };

  const handleDownloadPDF = async () => {
    if (!existingEvolution || !sessionId) return;
    
    try {
      const response = await supabase.functions.invoke('generate-evolution-pdf', {
        body: { evolutionId: existingEvolution.id },
      });
      
      if (response.error) throw response.error;
      
      // Crear blob y descargar
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evolucion_sesion_${session?.numero_sesion || ''}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'PDF generado',
        description: 'El PDF ha sido descargado',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al generar PDF',
        description: error.message,
      });
    }
  };

  if (!session) return null;

  const patient = session.medical_orders?.patients;
  const therapist = session.medical_orders?.therapist_profiles;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Evolución Clínica - Sesión #{session.numero_sesion}
          </DialogTitle>
          <DialogDescription>
            {patient?.nombre_completo} • {format(new Date(session.fecha_programada), "d 'de' MMMM 'de' yyyy", { locale: es })}
            {session.medical_orders?.codigo_orden && (
              <Badge variant="outline" className="ml-2 font-mono">
                {session.medical_orders.codigo_orden}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Alert: Not assigned therapist */}
        {isTherapist && !isAssignedTherapist && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Solo el terapeuta asignado ({therapist?.nombre_completo}) puede crear o editar evoluciones para este paciente.
              Usted puede ver la evolución pero no modificarla.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert: Admin viewing */}
        {isAdmin && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Como administrador, puede ver las evoluciones pero no crearlas ni editarlas.
              Solo los terapeutas asignados pueden gestionar evoluciones.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert: Pending previous sessions */}
        {isAssignedTherapist && !existingEvolution && pendingPreviousSessions && pendingPreviousSessions.length > 0 && (
          <Alert variant="destructive">
            <ListOrdered className="h-4 w-4" />
            <AlertDescription>
              Debe completar las evoluciones de las sesiones anteriores primero:
              <span className="font-medium ml-1">
                Sesiones {pendingPreviousSessions.map(s => `#${s.numero_sesion}`).join(', ')}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Indicador de bloqueo */}
        {isLocked ? (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Esta evolución está bloqueada y no puede ser modificada. 
              {existingEvolution?.bloqueado_at && (
                <span className="block text-xs mt-1">
                  Bloqueada el {format(new Date(existingEvolution.bloqueado_at), "d/MM/yyyy 'a las' HH:mm", { locale: es })}
                </span>
              )}
            </AlertDescription>
          </Alert>
        ) : isExpired ? (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Han pasado más de 24 horas desde la creación. Esta evolución ya no puede ser editada.
            </AlertDescription>
          </Alert>
        ) : existingEvolution && isAssignedTherapist ? (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Tiempo restante para editar: <strong>{hoursRemaining} horas</strong>. 
              Después de 24 horas, la evolución se bloqueará automáticamente.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Info del paciente */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{patient?.nombre_completo}</p>
              {patient?.fecha_nacimiento && (
                <p className="text-sm text-muted-foreground">
                  {formatearEdad(patient.fecha_nacimiento)} • {patient.cedula || 'Sin cédula'}
                </p>
              )}
            </div>
            <Badge variant="outline">
              {ESPECIALIDAD_LABELS[session.medical_orders?.especialidad as Especialidad]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Terapeuta:</span>
            <span className="font-medium text-foreground">{therapist?.nombre_completo}</span>
          </div>
          {session.medical_orders?.diagnostico && (
            <p className="text-sm text-muted-foreground pt-2 border-t">
              <strong>Diagnóstico:</strong> {session.medical_orders.diagnostico}
            </p>
          )}
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contenido principal de la evolución */}
            <FormField
              control={form.control}
              name="contenido"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isFirstSession ? 'Evaluación Inicial *' : 'Evolución de la Sesión *'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={isFirstSession 
                        ? "Describa la evaluación inicial del paciente, hallazgos, estado funcional..."
                        : "Describa la evolución del paciente, observaciones, respuesta al tratamiento..."
                      }
                      className="min-h-[120px]"
                      disabled={!canEdit && !canCreate}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Procedimientos */}
            <FormField
              control={form.control}
              name="procedimientos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Procedimientos Realizados</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Técnicas y procedimientos aplicados durante la sesión..."
                      className="min-h-[80px]"
                      disabled={!canEdit && !canCreate}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Plan de tratamiento */}
            <FormField
              control={form.control}
              name="plan_tratamiento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan de Tratamiento</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Plan para próximas sesiones, objetivos terapéuticos..."
                      className="min-h-[80px]"
                      disabled={!canEdit && !canCreate}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recomendaciones */}
            <FormField
              control={form.control}
              name="recomendaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recomendaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Indicaciones para el paciente, ejercicios en casa..."
                      className="min-h-[80px]"
                      disabled={!canEdit && !canCreate}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Concepto profesional (para cierre) */}
            {(isLastSession || form.watch('es_cierre')) && (
              <>
                <Separator />
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Esta es la última sesión o un cierre anticipado. Complete los campos de cierre.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="concepto_profesional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Concepto Profesional de Cierre</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Concepto profesional sobre el resultado del tratamiento..."
                          className="min-h-[100px]"
                          disabled={!canEdit && !canCreate}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="evaluacion_final"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evaluación Final</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Estado funcional final del paciente, logros alcanzados..."
                          className="min-h-[100px]"
                          disabled={!canEdit && !canCreate}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Toggle de cierre anticipado (solo si no es última sesión) */}
            {!isLastSession && (canEdit || canCreate) && (
              <FormField
                control={form.control}
                name="es_cierre"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Marcar como cierre anticipado
                      </FormLabel>
                      <FormDescription>
                        Habilite esta opción si esta es la última sesión del tratamiento
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!canEdit && !canCreate}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {/* Firma digital */}
            {therapist?.firma_digital_url && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground mb-2">Firma Digital:</p>
                <img 
                  src={therapist.firma_digital_url} 
                  alt="Firma digital"
                  className="max-h-16 object-contain"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {therapist.nombre_completo}
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {canEdit || canCreate ? 'Cancelar' : 'Cerrar'}
              </Button>
              
              {existingEvolution && (
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleDownloadPDF}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              )}
              
              {(canEdit || canCreate) && (
                <Button 
                  type="submit" 
                  disabled={saveEvolutionMutation.isPending}
                  className="flex-1 gap-2"
                >
                  {saveEvolutionMutation.isPending ? (
                    'Guardando...'
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar Evolución
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
