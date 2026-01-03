import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  FileText, 
  Filter,
  MoreVertical,
  Eye,
  Calendar,
  User,
  Stethoscope,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ESPECIALIDAD_LABELS, Especialidad, UBICACION_LABELS } from '@/types/database';
import MedicalOrderFormDialog from '@/components/orders/MedicalOrderFormDialog';
import MedicalOrderViewDialog from '@/components/orders/MedicalOrderViewDialog';
import SessionsDialog from '@/components/orders/SessionsDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MedicalOrderWithRelations {
  id: string;
  patient_id: string;
  therapist_id: string;
  especialidad: string;
  total_sesiones: number;
  sesiones_completadas: number;
  ubicacion: string;
  estado: string;
  diagnostico: string | null;
  created_at: string;
  patients: { nombre_completo: string } | null;
  therapist_profiles: { nombre_completo: string } | null;
}

export default function MedicalOrders() {
  const { isAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [sessionsDialogOrder, setSessionsDialogOrder] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['medical-orders', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('medical_orders')
        .select(`
          *,
          patients (nombre_completo),
          therapist_profiles (nombre_completo)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as MedicalOrderWithRelations[];
    },
  });

  const filteredOrders = orders?.filter(order => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      order.patients?.nombre_completo?.toLowerCase().includes(searchLower) ||
      order.therapist_profiles?.nombre_completo?.toLowerCase().includes(searchLower) ||
      order.diagnostico?.toLowerCase().includes(searchLower)
    );
  });

  const handleViewOrder = (orderId: string) => {
    setViewOrderId(orderId);
  };

  const handleViewSessions = (orderId: string) => {
    setSessionsDialogOrder(orderId);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Órdenes Médicas</h1>
          <p className="text-muted-foreground">
            Gestión de paquetes de sesiones terapéuticas
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva Orden
          </Button>
        )}
      </div>

      {/* Barra de búsqueda */}
      <Card className="card-clinical">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente, terapeuta o diagnóstico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de órdenes */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Lista de Órdenes Médicas
          </CardTitle>
          <CardDescription>
            {filteredOrders?.length || 0} órdenes registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Terapeuta</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {order.patients?.nombre_completo || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" />
                          {order.therapist_profiles?.nombre_completo || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`badge-especialidad badge-${order.especialidad.replace('_', '-')}`}>
                          {ESPECIALIDAD_LABELS[order.especialidad as Especialidad]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ 
                                width: `${(order.sesiones_completadas / order.total_sesiones) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {order.sesiones_completadas}/{order.total_sesiones}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {UBICACION_LABELS[order.ubicacion as 'intramural' | 'domiciliaria']}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.estado === 'activa' ? 'default' : 'secondary'}>
                          {order.estado === 'activa' ? 'Activa' : 'Cerrada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.created_at), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewOrder(order.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewSessions(order.id)}>
                              <Calendar className="mr-2 h-4 w-4" />
                              Ver Sesiones
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No hay órdenes médicas registradas</p>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2"
                  onClick={() => setIsFormOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Crear primera orden
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de formulario - Solo creación */}
      {isAdmin && (
        <MedicalOrderFormDialog
          open={isFormOpen}
          onClose={handleCloseForm}
          onSuccess={() => {
            handleCloseForm();
            refetch();
          }}
        />
      )}

      {/* Dialog de visualización de orden */}
      <MedicalOrderViewDialog
        open={!!viewOrderId}
        onClose={() => setViewOrderId(null)}
        orderId={viewOrderId}
      />

      {/* Dialog de sesiones */}
      <SessionsDialog
        open={!!sessionsDialogOrder}
        onClose={() => setSessionsDialogOrder(null)}
        orderId={sessionsDialogOrder}
        onSuccess={refetch}
      />
    </div>
  );
}