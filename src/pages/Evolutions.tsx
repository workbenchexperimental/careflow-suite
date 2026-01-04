import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Search, 
  FileText, 
  Lock, 
  Clock, 
  Eye,
  Download,
  Filter,
  ChevronDown,
  User,
  Stethoscope,
} from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ESPECIALIDAD_LABELS, 
  Especialidad,
  TherapistProfile 
} from '@/types/database';
import EvolutionFormDialog from '@/components/evolutions/EvolutionFormDialog';

interface GroupedOrder {
  orderId: string;
  codigoOrden: string;
  patientName: string;
  patientCedula: string;
  especialidad: string;
  therapistName: string;
  evolutions: any[];
}

export default function Evolutions() {
  const { isTherapist, isAdmin, profile } = useAuth();
  const therapistProfile = isTherapist ? (profile as TherapistProfile) : null;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEspecialidad, setFilterEspecialidad] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showEvolutionDialog, setShowEvolutionDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');

  const { data: evolutions, isLoading, refetch } = useQuery({
    queryKey: ['evolutions-list', therapistProfile?.id, isAdmin],
    queryFn: async () => {
      const query = supabase
        .from('evolutions')
        .select(`
          *,
          sessions (
            id,
            numero_sesion,
            fecha_programada,
            medical_orders (
              id,
              codigo_orden,
              especialidad,
              patients (
                id,
                nombre_completo,
                cedula
              ),
              therapist_profiles (
                id,
                nombre_completo
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Filter evolutions
  const filteredEvolutions = evolutions?.filter(evolution => {
    const patient = evolution.sessions?.medical_orders?.patients;
    const especialidad = evolution.sessions?.medical_orders?.especialidad;
    const codigoOrden = evolution.sessions?.medical_orders?.codigo_orden;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      patient?.nombre_completo?.toLowerCase().includes(searchLower) ||
      patient?.cedula?.toLowerCase().includes(searchLower) ||
      codigoOrden?.toLowerCase().includes(searchLower);
    
    const matchesEspecialidad = filterEspecialidad === 'all' || 
      especialidad === filterEspecialidad;
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'locked' && evolution.bloqueado) ||
      (filterStatus === 'editable' && !evolution.bloqueado);
    
    return matchesSearch && matchesEspecialidad && matchesStatus;
  });

  // Group evolutions by order
  const groupedByOrder = filteredEvolutions?.reduce<Record<string, GroupedOrder>>((acc, evolution) => {
    const orderId = evolution.sessions?.medical_orders?.id;
    if (!orderId) return acc;
    
    if (!acc[orderId]) {
      acc[orderId] = {
        orderId,
        codigoOrden: evolution.sessions?.medical_orders?.codigo_orden || 'Sin código',
        patientName: evolution.sessions?.medical_orders?.patients?.nombre_completo || 'N/A',
        patientCedula: evolution.sessions?.medical_orders?.patients?.cedula || '',
        especialidad: evolution.sessions?.medical_orders?.especialidad || '',
        therapistName: evolution.sessions?.medical_orders?.therapist_profiles?.nombre_completo || 'N/A',
        evolutions: [],
      };
    }
    acc[orderId].evolutions.push(evolution);
    return acc;
  }, {});

  const getTimeStatus = (evolution: any) => {
    if (evolution.bloqueado) {
      return { label: 'Bloqueada', variant: 'destructive' as const, icon: Lock };
    }
    const hoursRemaining = Math.max(0, 24 - differenceInHours(new Date(), new Date(evolution.created_at)));
    if (hoursRemaining <= 4) {
      return { label: `${hoursRemaining}h restantes`, variant: 'secondary' as const, icon: Clock, warning: true };
    }
    return { label: `${hoursRemaining}h restantes`, variant: 'secondary' as const, icon: Clock, warning: false };
  };

  const handleViewEvolution = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowEvolutionDialog(true);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evoluciones Clínicas</h1>
          <p className="text-muted-foreground">
            Gestione las evoluciones de las sesiones terapéuticas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Historial de Evoluciones
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'Todas las evoluciones registradas en el sistema'
                : 'Evoluciones de sus pacientes asignados'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código de orden, cédula o paciente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterEspecialidad} onValueChange={setFilterEspecialidad}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Especialidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(ESPECIALIDAD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="editable">Editables</SelectItem>
                  <SelectItem value="locked">Bloqueadas</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                >
                  Agrupado
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  Lista
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : viewMode === 'grouped' && groupedByOrder && Object.keys(groupedByOrder).length > 0 ? (
              /* Grouped View */
              <div className="space-y-4">
                {Object.values(groupedByOrder).map((group) => (
                  <div key={group.orderId} className="border rounded-lg overflow-hidden">
                    {/* Order Header */}
                    <div className="bg-muted/30 p-4 border-b">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-sm">
                            {group.codigoOrden}
                          </Badge>
                          <Badge variant="secondary">
                            {ESPECIALIDAD_LABELS[group.especialidad as Especialidad]}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {group.evolutions.length} evoluciones
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.patientName}</span>
                          {group.patientCedula && (
                            <span className="text-muted-foreground">({group.patientCedula})</span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Stethoscope className="h-4 w-4" />
                            <span>{group.therapistName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evolutions List */}
                    <div className="divide-y">
                      {group.evolutions
                        .sort((a, b) => a.sessions?.numero_sesion - b.sessions?.numero_sesion)
                        .map((evolution) => {
                          const session = evolution.sessions;
                          const timeStatus = getTimeStatus(evolution);
                          const StatusIcon = timeStatus.icon;

                          return (
                            <div 
                              key={evolution.id}
                              className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                <Badge variant="outline">
                                  Sesión #{session?.numero_sesion}
                                </Badge>
                                <div>
                                  <p className="text-sm">
                                    {format(new Date(session?.fecha_programada), 'dd/MM/yyyy', { locale: es })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Creada: {format(new Date(evolution.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                                  </p>
                                </div>
                                {evolution.es_cierre && (
                                  <Badge variant="secondary">Cierre</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={timeStatus.variant}
                                  className={`gap-1 ${timeStatus.warning ? 'bg-orange-500 text-white' : ''}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  {timeStatus.label}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewEvolution(session?.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEvolutions && filteredEvolutions.length > 0 ? (
              /* List View */
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Orden</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Sesión</TableHead>
                      <TableHead>Especialidad</TableHead>
                      {isAdmin && <TableHead>Terapeuta</TableHead>}
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvolutions.map((evolution) => {
                      const session = evolution.sessions;
                      const order = session?.medical_orders;
                      const patient = order?.patients;
                      const therapist = order?.therapist_profiles;
                      const especialidad = order?.especialidad;
                      const timeStatus = getTimeStatus(evolution);
                      const StatusIcon = timeStatus.icon;

                      return (
                        <TableRow key={evolution.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {order?.codigo_orden || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(evolution.created_at), 'dd/MM/yyyy', { locale: es })}
                            <span className="block text-xs text-muted-foreground">
                              {format(new Date(evolution.created_at), 'HH:mm', { locale: es })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{patient?.nombre_completo}</div>
                            <div className="text-xs text-muted-foreground">
                              {patient?.cedula || 'Sin cédula'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              Sesión #{session?.numero_sesion}
                            </Badge>
                            {evolution.es_cierre && (
                              <Badge variant="secondary" className="ml-1">
                                Cierre
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ESPECIALIDAD_LABELS[especialidad as Especialidad]}
                            </Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {therapist?.nombre_completo}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge 
                              variant={timeStatus.variant}
                              className={`gap-1 ${timeStatus.warning ? 'bg-orange-500 text-white' : ''}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {timeStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewEvolution(session?.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron evoluciones
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EvolutionFormDialog
        open={showEvolutionDialog}
        onClose={() => {
          setShowEvolutionDialog(false);
          setSelectedSessionId(null);
        }}
        sessionId={selectedSessionId}
        onSuccess={() => {
          refetch();
        }}
      />
    </>
  );
}
