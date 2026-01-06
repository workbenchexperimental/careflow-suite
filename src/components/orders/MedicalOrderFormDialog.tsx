import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, User, Stethoscope, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { ESPECIALIDAD_LABELS, Especialidad, ESPECIALIDADES_DOMICILIARIAS, UbicacionSesion } from '@/types/database';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { addDays, format, setHours, setMinutes } from 'date-fns';

const orderSchema = z.object({
  codigo_orden: z.string().min(1, 'Ingrese el código de la orden médica'),
  patient_id: z.string().min(1, 'Seleccione un paciente'),
  therapist_id: z.string().min(1, 'Seleccione un terapeuta'),
  especialidad: z.enum([
    'fisioterapia',
    'fonoaudiologia',
    'terapia_ocupacional',
    'psicologia',
    'terapia_acuatica',
  ] as const),
  total_sesiones: z.number().min(1, 'Debe tener al menos 1 sesión').max(100, 'Máximo 100 sesiones'),
  ubicacion: z.enum(['intramural', 'domiciliaria'] as const),
  diagnostico: z.string().optional(),
  observaciones: z.string().optional(),
  // Campos para generación de agenda
  fecha_inicio: z.string().min(1, 'Seleccione fecha de inicio'),
  hora_inicio: z.string().min(1, 'Seleccione hora de inicio'),
  dias_semana: z.array(z.number()).min(1, 'Seleccione al menos un día'),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface MedicalOrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DIAS_SEMANA = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

export default function MedicalOrderFormDialog({
  open,
  onClose,
  onSuccess,
}: MedicalOrderFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      codigo_orden: '',
      patient_id: '',
      therapist_id: '',
      especialidad: 'fisioterapia',
      total_sesiones: 10,
      ubicacion: 'intramural',
      diagnostico: '',
      observaciones: '',
      fecha_inicio: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      hora_inicio: '08:00',
      dias_semana: [1, 3, 5],
    },
  });

  const ubicacion = form.watch('ubicacion');
  const especialidad = form.watch('especialidad');

  // Validar especialidades para domiciliaria
  useEffect(() => {
    if (ubicacion === 'domiciliaria' && !ESPECIALIDADES_DOMICILIARIAS.includes(especialidad)) {
      form.setValue('especialidad', 'fisioterapia');
    }
  }, [ubicacion, especialidad, form]);

  // Cargar pacientes
  const { data: patients } = useQuery({
    queryKey: ['patients-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, nombre_completo')
        .eq('activo', true)
        .order('nombre_completo');
      if (error) throw error;
      return data;
    },
  });

  // Cargar terapeutas
  const { data: therapists } = useQuery({
    queryKey: ['therapists-select', especialidad],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('id, nombre_completo, especialidad')
        .eq('activo', true)
        .eq('especialidad', especialidad)
        .order('nombre_completo');
      if (error) throw error;
      return data;
    },
    enabled: !!especialidad,
  });

  // Limpiar terapeuta cuando cambia especialidad
  useEffect(() => {
    form.setValue('therapist_id', '');
  }, [especialidad, form]);

  const generateSessions = (
    fechaInicio: string,
    horaInicio: string,
    totalSesiones: number,
    diasSemana: number[],
    ubicacion: UbicacionSesion
  ) => {
    const sessions = [];
    
    // Parsear la fecha correctamente para evitar problemas de timezone UTC
    const [year, month, day] = fechaInicio.split('-').map(Number);
    let currentDate = new Date(year, month - 1, day); // mes es 0-indexed
    const startDate = new Date(year, month - 1, day);
    
    let sessionNumber = 1;

    while (sessionNumber <= totalSesiones) {
      const dayOfWeek = currentDate.getDay();
      // Convertir domingo (0) a 7 para coincidir con ISO (Lun=1, Dom=7)
      const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

      if (diasSemana.includes(isoDay)) {
        sessions.push({
          numero_sesion: sessionNumber,
          fecha_programada: format(currentDate, 'yyyy-MM-dd'),
          hora_inicio: horaInicio,
          ubicacion,
          estado: 'programada' as const,
        });
        sessionNumber++;
      }

      currentDate = addDays(currentDate, 1);

      // Prevenir bucle infinito (máximo 1 año)
      if (currentDate > addDays(startDate, 365)) {
        break;
      }
    }

    return sessions;
  };

  const mutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      // Crear orden
      const { data: newOrder, error: orderError } = await supabase
        .from('medical_orders')
        .insert({
          codigo_orden: data.codigo_orden,
          patient_id: data.patient_id,
          therapist_id: data.therapist_id,
          especialidad: data.especialidad,
          total_sesiones: data.total_sesiones,
          ubicacion: data.ubicacion,
          diagnostico: data.diagnostico || null,
          observaciones: data.observaciones || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Generar sesiones
      const sessions = generateSessions(
        data.fecha_inicio,
        data.hora_inicio,
        data.total_sesiones,
        data.dias_semana,
        data.ubicacion
      );

      const sessionsWithOrderId = sessions.map(session => ({
        ...session,
        medical_order_id: newOrder.id,
      }));

      const { error: sessionsError } = await supabase
        .from('sessions')
        .insert(sessionsWithOrderId);

      if (sessionsError) throw sessionsError;
    },
    onSuccess: () => {
      toast({
        title: 'Orden creada',
        description: 'La orden médica y sus sesiones han sido creadas exitosamente',
      });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar la orden',
      });
    },
  });

  const onSubmit = (data: OrderFormData) => {
    mutation.mutate({ ...data, dias_semana: selectedDays });
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const especialidadesDisponibles = ubicacion === 'domiciliaria'
    ? ESPECIALIDADES_DOMICILIARIAS
    : (Object.keys(ESPECIALIDAD_LABELS) as Especialidad[]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Nueva Orden Médica</DialogTitle>
          <DialogDescription>
            Complete los datos para crear una nueva orden y generar la agenda automáticamente
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Código de Orden Médica */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Orden Médica</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="codigo_orden"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Orden Médica *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ej: 12345-2026" 
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Ingrese el número de la orden médica tal como aparece en el documento del doctor
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Paciente y Terapeuta */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Asignación</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="patient_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paciente *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione paciente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {patients?.map((patient) => (
                              <SelectItem key={patient.id} value={patient.id}>
                                {patient.nombre_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="especialidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Especialidad *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione especialidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {especialidadesDisponibles.map((esp) => (
                              <SelectItem key={esp} value={esp}>
                                {ESPECIALIDAD_LABELS[esp]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="therapist_id"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Terapeuta *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={
                                therapists?.length === 0 
                                  ? 'No hay terapeutas de esta especialidad'
                                  : 'Seleccione terapeuta'
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {therapists?.map((therapist) => (
                              <SelectItem key={therapist.id} value={therapist.id}>
                                {therapist.nombre_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Configuración del paquete */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Configuración del Paquete</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="total_sesiones"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total de Sesiones *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ubicacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="intramural">Intramural</SelectItem>
                            <SelectItem value="domiciliaria">Domiciliaria</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="diagnostico"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Diagnóstico</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Diagnóstico médico del paciente"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Generación de Agenda */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Generación de Agenda</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fecha_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Inicio *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hora_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora de Sesiones *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="sm:col-span-2">
                    <FormLabel>Días de la Semana *</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DIAS_SEMANA.map((dia) => (
                        <Button
                          key={dia.value}
                          type="button"
                          variant={selectedDays.includes(dia.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleDay(dia.value)}
                        >
                          {dia.label}
                        </Button>
                      ))}
                    </div>
                    {selectedDays.length === 0 && (
                      <p className="text-sm text-destructive mt-1">
                        Seleccione al menos un día
                      </p>
                    )}
                  </div>
                </div>

                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se generarán automáticamente {form.watch('total_sesiones')} sesiones 
                    comenzando el {form.watch('fecha_inicio') ? format(new Date(form.watch('fecha_inicio')), 'dd/MM/yyyy') : '...'} 
                    {' '}a las {form.watch('hora_inicio') || '...'}
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              {/* Botones */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={mutation.isPending || selectedDays.length === 0}
                >
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Guardando...
                    </span>
                  ) : (
                    'Crear Orden y Agenda'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}