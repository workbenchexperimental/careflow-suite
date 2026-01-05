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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  ClipboardList, 
  Save,
  ShieldAlert,
  Activity,
  Target,
  Brain,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  TherapistProfile,
  ESPECIALIDAD_LABELS,
  Especialidad,
  formatearEdad 
} from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// Schema de validación
const initialEvaluationSchema = z.object({
  // CIE-10
  diagnostico_cie10: z.string().min(10, 'El diagnóstico debe tener al menos 10 caracteres'),
  codigo_cie10: z.string().optional(),
  
  // CIF
  funciones_corporales: z.string().optional(),
  estructuras_corporales: z.string().optional(),
  actividades_participacion: z.string().optional(),
  factores_ambientales: z.string().optional(),
  factores_personales: z.string().optional(),
  
  // Plan de tratamiento
  objetivos_generales: z.string().min(10, 'Los objetivos generales son requeridos'),
  objetivos_especificos: z.string().optional(),
  plan_intervencion: z.string().min(10, 'El plan de intervención es requerido'),
  frecuencia_sesiones: z.string().optional(),
  duracion_estimada: z.string().optional(),
});

type InitialEvaluationFormData = z.infer<typeof initialEvaluationSchema>;

interface InitialEvaluationDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess?: () => void;
}

export default function InitialEvaluationDialog({
  open,
  onClose,
  orderId,
  onSuccess,
}: InitialEvaluationDialogProps) {
  const { toast } = useToast();
  const { profile, isTherapist, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const therapistProfile = isTherapist ? (profile as TherapistProfile) : null;

  const form = useForm<InitialEvaluationFormData>({
    resolver: zodResolver(initialEvaluationSchema),
    defaultValues: {
      diagnostico_cie10: '',
      codigo_cie10: '',
      funciones_corporales: '',
      estructuras_corporales: '',
      actividades_participacion: '',
      factores_ambientales: '',
      factores_personales: '',
      objetivos_generales: '',
      objetivos_especificos: '',
      plan_intervencion: '',
      frecuencia_sesiones: '',
      duracion_estimada: '',
    },
  });

  // Query para obtener datos de la orden
  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['order-for-initial-eval', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          *,
          patients (
            id,
            nombre_completo,
            cedula,
            fecha_nacimiento
          ),
          therapist_profiles (
            id,
            nombre_completo,
            user_id
          )
        `)
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  // Query para verificar si ya existe evaluación inicial
  const { data: existingEvaluation, isLoading: loadingExisting } = useQuery({
    queryKey: ['initial-evaluation', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('initial_evaluations')
        .select('*')
        .eq('medical_order_id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  // Cargar datos existentes
  useEffect(() => {
    if (existingEvaluation) {
      form.reset({
        diagnostico_cie10: existingEvaluation.diagnostico_cie10 || '',
        codigo_cie10: existingEvaluation.codigo_cie10 || '',
        funciones_corporales: existingEvaluation.funciones_corporales || '',
        estructuras_corporales: existingEvaluation.estructuras_corporales || '',
        actividades_participacion: existingEvaluation.actividades_participacion || '',
        factores_ambientales: existingEvaluation.factores_ambientales || '',
        factores_personales: existingEvaluation.factores_personales || '',
        objetivos_generales: existingEvaluation.objetivos_generales || '',
        objetivos_especificos: existingEvaluation.objetivos_especificos || '',
        plan_intervencion: existingEvaluation.plan_intervencion || '',
        frecuencia_sesiones: existingEvaluation.frecuencia_sesiones || '',
        duracion_estimada: existingEvaluation.duracion_estimada || '',
      });
    } else {
      form.reset({
        diagnostico_cie10: '',
        codigo_cie10: '',
        funciones_corporales: '',
        estructuras_corporales: '',
        actividades_participacion: '',
        factores_ambientales: '',
        factores_personales: '',
        objetivos_generales: '',
        objetivos_especificos: '',
        plan_intervencion: '',
        frecuencia_sesiones: '',
        duracion_estimada: '',
      });
    }
  }, [existingEvaluation, form]);

  // Verificar si es el terapeuta asignado
  const assignedTherapistUserId = order?.therapist_profiles?.user_id;
  const currentUserId = profile?.user_id;
  const isAssignedTherapist = isTherapist && assignedTherapistUserId === currentUserId;
  const canCreate = isAssignedTherapist && !existingEvaluation;

  // Mutation para guardar
  const saveEvaluationMutation = useMutation({
    mutationFn: async (data: InitialEvaluationFormData) => {
      if (!orderId || !therapistProfile?.id) {
        throw new Error('Datos incompletos');
      }

      if (!isAssignedTherapist) {
        throw new Error('Solo el terapeuta asignado puede crear la evaluación inicial');
      }

      if (existingEvaluation) {
        throw new Error('Ya existe una evaluación inicial para esta orden. Las evaluaciones iniciales son inmutables.');
      }

      const evaluationData = {
        medical_order_id: orderId,
        therapist_id: therapistProfile.id,
        diagnostico_cie10: data.diagnostico_cie10,
        codigo_cie10: data.codigo_cie10 || null,
        funciones_corporales: data.funciones_corporales || null,
        estructuras_corporales: data.estructuras_corporales || null,
        actividades_participacion: data.actividades_participacion || null,
        factores_ambientales: data.factores_ambientales || null,
        factores_personales: data.factores_personales || null,
        objetivos_generales: data.objetivos_generales,
        objetivos_especificos: data.objetivos_especificos || null,
        plan_intervencion: data.plan_intervencion,
        frecuencia_sesiones: data.frecuencia_sesiones || null,
        duracion_estimada: data.duracion_estimada || null,
      };

      const { error } = await supabase
        .from('initial_evaluations')
        .insert(evaluationData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initial-evaluation', orderId] });
      queryClient.invalidateQueries({ queryKey: ['initial-evaluations'] });
      toast({
        title: 'Evaluación inicial guardada',
        description: 'La evaluación inicial ha sido guardada exitosamente. Ahora puede iniciar las sesiones.',
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: InitialEvaluationFormData) => {
    saveEvaluationMutation.mutate(data);
  };

  if (!order) return null;

  const patient = order.patients;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Evaluación Inicial
          </DialogTitle>
          <DialogDescription>
            {patient?.nombre_completo} • {order.codigo_orden}
            <Badge variant="outline" className="ml-2">
              {ESPECIALIDAD_LABELS[order.especialidad as Especialidad]}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Alert: Not assigned therapist */}
        {isTherapist && !isAssignedTherapist && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Solo el terapeuta asignado puede crear la evaluación inicial.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert: Admin viewing */}
        {isAdmin && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Como administrador, puede ver las evaluaciones pero no crearlas ni editarlas.
            </AlertDescription>
          </Alert>
        )}

        {/* Alert: Already exists */}
        {existingEvaluation && (
          <Alert>
            <ClipboardList className="h-4 w-4" />
            <AlertDescription>
              Esta evaluación inicial fue creada el {format(new Date(existingEvaluation.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })} y no puede ser modificada.
            </AlertDescription>
          </Alert>
        )}

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
            <Badge variant="secondary">
              {order.total_sesiones} sesiones
            </Badge>
          </div>
        </div>

        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* CIE-10 */}
            <Accordion type="single" collapsible defaultValue="cie10" className="w-full">
              <AccordionItem value="cie10">
                <AccordionTrigger className="text-base">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Diagnóstico CIE-10
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="diagnostico_cie10"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diagnóstico *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describa el diagnóstico según CIE-10..."
                                className="min-h-[80px]"
                                disabled={!canCreate}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <FormField
                        control={form.control}
                        name="codigo_cie10"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código CIE-10</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: G80.0"
                                disabled={!canCreate}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>Código alfanumérico</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cif">
                <AccordionTrigger className="text-base">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Clasificación CIF
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="funciones_corporales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Funciones Corporales</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Funciones fisiológicas y psicológicas de los sistemas corporales..."
                            className="min-h-[60px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estructuras_corporales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estructuras Corporales</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Partes anatómicas del cuerpo afectadas..."
                            className="min-h-[60px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actividades_participacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actividades y Participación</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Capacidad y desempeño del individuo en actividades..."
                            className="min-h-[60px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="factores_ambientales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factores Ambientales</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ambiente físico, social, actitudinal..."
                              className="min-h-[60px]"
                              disabled={!canCreate}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="factores_personales"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Factores Personales</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Características del individuo: edad, género, hábitos..."
                              className="min-h-[60px]"
                              disabled={!canCreate}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="plan">
                <AccordionTrigger className="text-base">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Plan de Tratamiento
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="objetivos_generales"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivos Generales *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Objetivos terapéuticos generales del tratamiento..."
                            className="min-h-[80px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="objetivos_especificos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Objetivos Específicos</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Objetivos específicos medibles y alcanzables..."
                            className="min-h-[80px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan_intervencion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Plan de Intervención *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Estrategias, técnicas y actividades terapéuticas a implementar..."
                            className="min-h-[100px]"
                            disabled={!canCreate}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="frecuencia_sesiones"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frecuencia de Sesiones</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: 2 veces por semana"
                              disabled={!canCreate}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="duracion_estimada"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duración Estimada</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: 3 meses"
                              disabled={!canCreate}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {canCreate ? 'Cancelar' : 'Cerrar'}
              </Button>
              
              {canCreate && (
                <Button 
                  type="submit" 
                  disabled={saveEvaluationMutation.isPending}
                  className="flex-1 gap-2"
                >
                  {saveEvaluationMutation.isPending ? (
                    'Guardando...'
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar Evaluación Inicial
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
