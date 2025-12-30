import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Shield, AlertCircle } from 'lucide-react';
import { ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';
import { Alert, AlertDescription } from '@/components/ui/alert';

const therapistSchema = z.object({
  nombre_completo: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  cedula: z.string().min(5, 'La cédula es requerida'),
  email: z.string().email('Correo electrónico inválido'),
  telefono: z.string().optional(),
  especialidad: z.enum([
    'fisioterapia',
    'fonoaudiologia',
    'terapia_ocupacional',
    'psicologia',
    'terapia_acuatica',
  ] as const),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  activo: z.boolean().default(true),
});

type TherapistFormData = z.infer<typeof therapistSchema>;

interface TherapistFormDialogProps {
  open: boolean;
  onClose: () => void;
  therapistId?: string | null;
  onSuccess: () => void;
}

export default function TherapistFormDialog({
  open,
  onClose,
  therapistId,
  onSuccess,
}: TherapistFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!therapistId;
  const [showPassword, setShowPassword] = useState(!isEditing);

  const form = useForm<TherapistFormData>({
    resolver: zodResolver(
      isEditing 
        ? therapistSchema.omit({ password: true }) 
        : therapistSchema.extend({
            password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
          })
    ),
    defaultValues: {
      nombre_completo: '',
      cedula: '',
      email: '',
      telefono: '',
      especialidad: 'fisioterapia',
      password: '',
      activo: true,
    },
  });

  // Cargar datos del terapeuta si estamos editando
  const { data: therapist } = useQuery({
    queryKey: ['therapist', therapistId],
    queryFn: async () => {
      if (!therapistId) return null;
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('*')
        .eq('id', therapistId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!therapistId,
  });

  useEffect(() => {
    if (therapist) {
      form.reset({
        nombre_completo: therapist.nombre_completo,
        cedula: therapist.cedula,
        email: therapist.email,
        telefono: therapist.telefono || '',
        especialidad: therapist.especialidad as Especialidad,
        activo: therapist.activo,
      });
    }
  }, [therapist, form]);

  const mutation = useMutation({
    mutationFn: async (data: TherapistFormData) => {
      if (isEditing) {
        // Actualizar perfil existente
        const { error } = await supabase
          .from('therapist_profiles')
          .update({
            nombre_completo: data.nombre_completo,
            cedula: data.cedula,
            email: data.email,
            telefono: data.telefono || null,
            especialidad: data.especialidad,
            activo: data.activo,
          })
          .eq('id', therapistId);
        if (error) throw error;
      } else {
        // Usar edge function para crear el terapeuta (bypasses RLS)
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) throw new Error('No hay sesión activa');

        const response = await supabase.functions.invoke('create-therapist', {
          body: {
            email: data.email,
            password: data.password,
            nombre_completo: data.nombre_completo,
            cedula: data.cedula,
            telefono: data.telefono || null,
            especialidad: data.especialidad,
            activo: data.activo,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Error al crear terapeuta');
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: isEditing ? 'Terapeuta actualizado' : 'Terapeuta creado',
        description: isEditing 
          ? 'Los datos del terapeuta han sido actualizados'
          : 'El terapeuta ha sido registrado. Las credenciales fueron enviadas por correo.',
      });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      let errorMessage = error.message || 'Ocurrió un error al guardar el terapeuta';
      
      if (error.message.includes('User already registered')) {
        errorMessage = 'Ya existe un usuario con este correo electrónico';
      } else if (error.message.includes('duplicate key')) {
        errorMessage = 'Ya existe un terapeuta con esta cédula';
      }

      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });

  const onSubmit = (data: TherapistFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Terapeuta' : 'Nuevo Terapeuta'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Actualice los datos del terapeuta'
              : 'Complete los datos para registrar un nuevo terapeuta'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Información básica */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Información del Terapeuta</span>
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nombre_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre completo" {...field} />
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
                        <FormLabel>Cédula *</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de cédula" {...field} />
                        </FormControl>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione especialidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(ESPECIALIDAD_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
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

                  {isEditing && (
                    <FormField
                      control={form.control}
                      name="activo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Estado Activo</FormLabel>
                            <FormDescription>
                              Los terapeutas inactivos no pueden acceder al sistema
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Credenciales */}
              <div className="form-section">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="form-section-title">Credenciales de Acceso</span>
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="correo@ejemplo.com" 
                            {...field} 
                            disabled={isEditing}
                          />
                        </FormControl>
                        {isEditing && (
                          <FormDescription>
                            El correo no puede ser modificado
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isEditing && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña Temporal *</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Mínimo 6 caracteres" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            El terapeuta deberá cambiarla en su primer acceso
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {!isEditing && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Se enviará un correo automático al terapeuta con sus credenciales de acceso.
                    Adicionalmente, comunique las credenciales de forma manual.
                  </AlertDescription>
                </Alert>
              )}

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
                    'Crear Terapeuta'
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