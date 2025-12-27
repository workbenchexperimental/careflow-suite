import { useEffect } from 'react';
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
import { User, MapPin, Heart, Phone } from 'lucide-react';
import { formatearEdad, Sexo } from '@/types/database';

const patientSchema = z.object({
  nombre_completo: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  cedula: z.string().optional(),
  sexo: z.enum(['masculino', 'femenino', 'otro'] as const),
  fecha_nacimiento: z.string().min(1, 'La fecha de nacimiento es requerida'),
  ciudad: z.string().optional(),
  direccion: z.string().optional(),
  eps: z.string().optional(),
  ocupacion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  acudiente_nombre: z.string().min(3, 'El nombre del acudiente es requerido'),
  acudiente_telefono: z.string().min(7, 'El teléfono del acudiente es requerido'),
  acudiente_parentesco: z.string().min(2, 'El parentesco es requerido'),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormDialogProps {
  open: boolean;
  onClose: () => void;
  patientId?: string | null;
  onSuccess: () => void;
}

export default function PatientFormDialog({
  open,
  onClose,
  patientId,
  onSuccess,
}: PatientFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEditing = !!patientId;

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      nombre_completo: '',
      cedula: '',
      sexo: 'masculino',
      fecha_nacimiento: '',
      ciudad: '',
      direccion: '',
      eps: '',
      ocupacion: '',
      telefono: '',
      email: '',
      acudiente_nombre: '',
      acudiente_telefono: '',
      acudiente_parentesco: '',
    },
  });

  const fechaNacimiento = form.watch('fecha_nacimiento');

  // Cargar datos del paciente si estamos editando
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  useEffect(() => {
    if (patient) {
      form.reset({
        nombre_completo: patient.nombre_completo,
        cedula: patient.cedula || '',
        sexo: patient.sexo as Sexo,
        fecha_nacimiento: patient.fecha_nacimiento,
        ciudad: patient.ciudad || '',
        direccion: patient.direccion || '',
        eps: patient.eps || '',
        ocupacion: patient.ocupacion || '',
        telefono: patient.telefono || '',
        email: patient.email || '',
        acudiente_nombre: patient.acudiente_nombre,
        acudiente_telefono: patient.acudiente_telefono,
        acudiente_parentesco: patient.acudiente_parentesco,
      });
    }
  }, [patient, form]);

  const mutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const patientData = {
        ...data,
        cedula: data.cedula || null,
        ciudad: data.ciudad || null,
        direccion: data.direccion || null,
        eps: data.eps || null,
        ocupacion: data.ocupacion || null,
        telefono: data.telefono || null,
        email: data.email || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('patients')
          .update(patientData)
          .eq('id', patientId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('patients')
          .insert([{
            ...patientData,
            created_by: user?.id,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: isEditing ? 'Paciente actualizado' : 'Paciente creado',
        description: isEditing 
          ? 'Los datos del paciente han sido actualizados'
          : 'El paciente ha sido registrado exitosamente',
      });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar el paciente',
      });
    },
  });

  const onSubmit = (data: PatientFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Paciente' : 'Nuevo Paciente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Actualice los datos del paciente'
              : 'Complete los datos para registrar un nuevo paciente'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Datos personales */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Datos Personales</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nombre_completo"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nombre Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo del paciente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cedula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cédula / Documento</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de documento" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sexo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sexo *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="femenino">Femenino</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fecha_nacimiento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Nacimiento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        {fechaNacimiento && (
                          <p className="text-sm text-muted-foreground">
                            Edad: {formatearEdad(fechaNacimiento)}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EPS</FormLabel>
                        <FormControl>
                          <Input placeholder="Entidad de salud" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ocupacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ocupación</FormLabel>
                        <FormControl>
                          <Input placeholder="Ocupación" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="Teléfono de contacto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Ubicación */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Ubicación</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="ciudad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ciudad de residencia" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="direccion"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Dirección completa" 
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

              {/* Acudiente */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <Heart className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Acudiente / Responsable</span>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="acudiente_nombre"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nombre del Acudiente *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo del acudiente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="acudiente_telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono del Acudiente *</FormLabel>
                        <FormControl>
                          <Input placeholder="Teléfono de contacto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="acudiente_parentesco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parentesco *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Madre, Padre, Hijo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Botones */}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Guardando...
                    </span>
                  ) : isEditing ? (
                    'Actualizar'
                  ) : (
                    'Crear Paciente'
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