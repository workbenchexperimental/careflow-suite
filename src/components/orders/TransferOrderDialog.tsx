import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, AlertTriangle, User, Stethoscope } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';

interface TransferOrderDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onSuccess?: () => void;
}

export default function TransferOrderDialog({
  open,
  onClose,
  orderId,
  onSuccess,
}: TransferOrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTherapist, setSelectedTherapist] = useState<string>('');
  const [motivo, setMotivo] = useState('');

  // Fetch order details
  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['order-transfer', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          id,
          codigo_orden,
          especialidad,
          total_sesiones,
          sesiones_completadas,
          estado,
          patients(nombre_completo),
          therapist_profiles(id, nombre_completo)
        `)
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  // Fetch available therapists with same specialty
  const { data: therapists } = useQuery({
    queryKey: ['therapists-transfer', order?.especialidad],
    queryFn: async () => {
      if (!order?.especialidad) return [];
      const { data, error } = await supabase
        .from('therapist_profiles')
        .select('id, nombre_completo, especialidad')
        .eq('activo', true)
        .eq('especialidad', order.especialidad)
        .neq('id', order.therapist_profiles?.id || '')
        .order('nombre_completo');
      if (error) throw error;
      return data;
    },
    enabled: !!order?.especialidad,
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!orderId || !selectedTherapist || !motivo || !order?.therapist_profiles?.id) {
        throw new Error('Datos incompletos');
      }

      // Register transfer
      const { error: transferError } = await supabase
        .from('order_transfers')
        .insert({
          medical_order_id: orderId,
          from_therapist_id: order.therapist_profiles.id,
          to_therapist_id: selectedTherapist,
          motivo,
          transferred_by: user?.id || '',
        });

      if (transferError) throw transferError;

      // Update order with new therapist
      const { error: updateError } = await supabase
        .from('medical_orders')
        .update({ therapist_id: selectedTherapist })
        .eq('id', orderId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-transfer', orderId] });
      queryClient.invalidateQueries({ queryKey: ['patient-orders'] });
      toast({
        title: 'Paquete transferido',
        description: 'El paquete ha sido transferido exitosamente al nuevo terapeuta',
      });
      handleClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error al transferir',
        description: error.message,
      });
    },
  });

  const handleClose = () => {
    setSelectedTherapist('');
    setMotivo('');
    onClose();
  };

  const handleTransfer = () => {
    if (!selectedTherapist || !motivo.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Seleccione un terapeuta e ingrese el motivo de transferencia',
      });
      return;
    }
    transferMutation.mutate();
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir Paquete
          </DialogTitle>
          <DialogDescription>
            Transfiera este paquete de sesiones a otro terapeuta de la misma especialidad
          </DialogDescription>
        </DialogHeader>

        {loadingOrder ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order Info */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono">
                  {order.codigo_orden || 'Sin código'}
                </Badge>
                <Badge variant="secondary">
                  {ESPECIALIDAD_LABELS[order.especialidad as Especialidad]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{order.patients?.nombre_completo}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Stethoscope className="h-4 w-4" />
                <span>Terapeuta actual: {order.therapist_profiles?.nombre_completo}</span>
              </div>
              <div className="text-sm">
                Progreso: {order.sesiones_completadas}/{order.total_sesiones} sesiones
              </div>
            </div>

            {/* Warning */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Las evoluciones existentes se mantendrán con el terapeuta original. 
                Las sesiones pendientes serán atendidas por el nuevo terapeuta.
              </AlertDescription>
            </Alert>

            {/* New Therapist Selection */}
            <div className="space-y-2">
              <Label htmlFor="new-therapist">Nuevo Terapeuta *</Label>
              <Select value={selectedTherapist} onValueChange={setSelectedTherapist}>
                <SelectTrigger id="new-therapist">
                  <SelectValue placeholder="Seleccione nuevo terapeuta" />
                </SelectTrigger>
                <SelectContent>
                  {therapists?.length === 0 ? (
                    <SelectItem value="" disabled>
                      No hay otros terapeutas de esta especialidad
                    </SelectItem>
                  ) : (
                    therapists?.map((therapist) => (
                      <SelectItem key={therapist.id} value={therapist.id}>
                        {therapist.nombre_completo}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo de Transferencia *</Label>
              <Textarea
                id="motivo"
                placeholder="Describa el motivo por el cual se transfiere este paquete..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer}
            disabled={transferMutation.isPending || !selectedTherapist || !motivo.trim()}
          >
            {transferMutation.isPending ? 'Transfiriendo...' : 'Transferir Paquete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
