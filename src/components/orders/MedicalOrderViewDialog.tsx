import { useQuery } from '@tanstack/react-query';
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
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  User, 
  Stethoscope, 
  Calendar,
  MapPin,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ESPECIALIDAD_LABELS, 
  Especialidad, 
  UBICACION_LABELS 
} from '@/types/database';

interface MedicalOrderViewDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

export default function MedicalOrderViewDialog({
  open,
  onClose,
  orderId,
}: MedicalOrderViewDialogProps) {
  const { data: order, isLoading } = useQuery({
    queryKey: ['medical-order-detail', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          *,
          patients (nombre_completo, cedula),
          therapist_profiles (nombre_completo, especialidad)
        `)
        .eq('id', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Detalles de la Orden Médica
          </DialogTitle>
          <DialogDescription>
            Creada el {format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estado:</span>
            <Badge variant={order.estado === 'activa' ? 'default' : 'secondary'}>
              {order.estado === 'activa' ? 'Activa' : 'Cerrada'}
            </Badge>
          </div>

          <Separator />

          {/* Paciente */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Paciente
            </h4>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium">{order.patients?.nombre_completo}</p>
              {order.patients?.cedula && (
                <p className="text-sm text-muted-foreground">C.C. {order.patients.cedula}</p>
              )}
            </div>
          </div>

          {/* Terapeuta */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Terapeuta Asignado
            </h4>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium">{order.therapist_profiles?.nombre_completo}</p>
              <p className="text-sm text-muted-foreground">
                {ESPECIALIDAD_LABELS[order.especialidad as Especialidad]}
              </p>
            </div>
          </div>

          <Separator />

          {/* Configuración del paquete */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
                Sesiones
              </span>
              <span className="font-medium">
                {order.sesiones_completadas} / {order.total_sesiones}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Ubicación
              </span>
              <span className="font-medium">
                {UBICACION_LABELS[order.ubicacion as 'intramural' | 'domiciliaria']}
              </span>
            </div>
          </div>

          {/* Diagnóstico */}
          {order.diagnostico && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold">Diagnóstico</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {order.diagnostico}
                </p>
              </div>
            </>
          )}

          {/* Observaciones */}
          {order.observaciones && (
            <div className="space-y-2">
              <h4 className="font-semibold">Observaciones</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                {order.observaciones}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}