import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { UbicacionSesion } from '@/types/database';

const rescheduleSchema = z.object({
  nueva_fecha: z.string().min(1, 'Seleccione una fecha'),
  nueva_hora: z.string().min(1, 'Seleccione una hora'),
});

type RescheduleFormData = z.infer<typeof rescheduleSchema>;

interface RescheduleSessionDialogProps {
  open: boolean;
  onClose: () => void;
  session: {
    id: string;
    numero_sesion: number;
    medical_order_id: string;
    ubicacion: string;
    notas_cancelacion?: string | null;
  } | null;
  onSuccess?: () => void;
}

export default function RescheduleSessionDialog({
  open,
  onClose,
  session,
  onSuccess,
}: RescheduleSessionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RescheduleFormData>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      nueva_fecha: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      nueva_hora: '08:00',
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (data: RescheduleFormData) => {
      if (!session) throw new Error('No hay sesión seleccionada');

      // 1. Crear nueva sesión con los datos de la cancelada
      const { data: newSession, error: insertError } = await supabase
        .from('sessions')
        .insert({
          medical_order_id: session.medical_order_id,
          numero_sesion: session.numero_sesion,
          fecha_programada: data.nueva_fecha,
          hora_inicio: data.nueva_hora,
          ubicacion: session.ubicacion as UbicacionSesion,
          estado: 'programada',
          reprogramada_de: session.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Actualizar sesión original como reprogramada y vincularla
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          estado: 'reprogramada',
          reprogramada_a: newSession.id,
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

      return newSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['canceled-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['medical-orders'] });
      toast({
        title: 'Sesión reprogramada',
        description: 'La sesión ha sido reprogramada exitosamente',
      });
      form.reset();
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: RescheduleFormData) => {
    rescheduleMutation.mutate(data);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reprogramar Sesión #{session.numero_sesion}
          </DialogTitle>
          <DialogDescription>
            Seleccione la nueva fecha y hora para la sesión cancelada
          </DialogDescription>
        </DialogHeader>

        {session.notas_cancelacion && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
            <strong>Motivo de cancelación:</strong>
            <p className="mt-1">{session.notas_cancelacion}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nueva_fecha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Nueva Fecha
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      min={format(new Date(), 'yyyy-MM-dd')}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nueva_hora"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Nueva Hora
                  </FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={rescheduleMutation.isPending}
                className="flex-1"
              >
                {rescheduleMutation.isPending ? 'Reprogramando...' : 'Reprogramar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}