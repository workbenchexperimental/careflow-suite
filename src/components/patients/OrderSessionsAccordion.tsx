import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  ChevronRight, 
  Calendar, 
  Clock, 
  FileText, 
  Eye,
  CheckCircle,
  XCircle,
  Clock3,
  Home,
  Building2,
  Download,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ESPECIALIDAD_LABELS, 
  ESTADO_SESION_LABELS, 
  UBICACION_LABELS,
  Especialidad,
} from '@/types/database';
import EvolutionFormDialog from '@/components/evolutions/EvolutionFormDialog';
import InitialEvaluationDialog from '@/components/evolutions/InitialEvaluationDialog';
import { useToast } from '@/hooks/use-toast';

interface OrderWithSessions {
  id: string;
  codigo_orden: string | null;
  especialidad: string;
  total_sesiones: number;
  sesiones_completadas: number;
  estado: string;
  ubicacion: string;
  diagnostico: string | null;
  created_at: string;
  therapist: {
    id: string;
    nombre_completo: string;
    especialidad: string;
  } | null;
}

interface OrderSessionsAccordionProps {
  patientId: string;
}

export default function OrderSessionsAccordion({ patientId }: OrderSessionsAccordionProps) {
  const { toast } = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showEvolutionDialog, setShowEvolutionDialog] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showInitialEvalDialog, setShowInitialEvalDialog] = useState(false);

  // Fetch orders with sessions
  const { data: orders, isLoading: loadingOrders, refetch } = useQuery({
    queryKey: ['patient-orders-grouped', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          id,
          codigo_orden,
          especialidad,
          total_sesiones,
          sesiones_completadas,
          estado,
          ubicacion,
          diagnostico,
          created_at,
          therapist:therapist_profiles(id, nombre_completo, especialidad)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OrderWithSessions[];
    },
    enabled: !!patientId,
  });

  // Fetch sessions for all orders
  const { data: allSessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['patient-all-sessions', patientId],
    queryFn: async () => {
      if (!orders || orders.length === 0) return {};
      
      const orderIds = orders.map(o => o.id);
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          numero_sesion,
          fecha_programada,
          hora_inicio,
          estado,
          ubicacion,
          medical_order_id,
          evolutions(id, contenido, es_cierre)
        `)
        .in('medical_order_id', orderIds)
        .order('numero_sesion', { ascending: true });
      
      if (error) throw error;
      
      // Group sessions by order
      const grouped: Record<string, typeof data> = {};
      data?.forEach(session => {
        if (!grouped[session.medical_order_id]) {
          grouped[session.medical_order_id] = [];
        }
        grouped[session.medical_order_id].push(session);
      });
      
      return grouped;
    },
    enabled: !!orders && orders.length > 0,
  });

  // Fetch initial evaluations for all orders
  const { data: initialEvaluations } = useQuery({
    queryKey: ['patient-initial-evaluations', patientId],
    queryFn: async () => {
      if (!orders || orders.length === 0) return {};
      
      const orderIds = orders.map(o => o.id);
      const { data, error } = await supabase
        .from('initial_evaluations')
        .select('id, medical_order_id, created_at')
        .in('medical_order_id', orderIds);
      
      if (error) throw error;
      
      // Map by order id
      const mapped: Record<string, { id: string; created_at: string }> = {};
      data?.forEach(eval_ => {
        mapped[eval_.medical_order_id] = { id: eval_.id, created_at: eval_.created_at };
      });
      
      return mapped;
    },
    enabled: !!orders && orders.length > 0,
  });

  const handleViewEvolution = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowEvolutionDialog(true);
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completada':
      case 'plan_casero':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelada':
      case 'reprogramada':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getProgressColor = (completed: number, total: number) => {
    const percentage = (completed / total) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-primary';
  };

  if (loadingOrders) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-muted-foreground">No hay órdenes médicas registradas</p>
      </div>
    );
  }

  // Group orders by codigo_orden for multi-specialist orders
  const groupedOrders: Record<string, OrderWithSessions[]> = {};
  orders.forEach(order => {
    const key = order.codigo_orden || order.id;
    if (!groupedOrders[key]) {
      groupedOrders[key] = [];
    }
    groupedOrders[key].push(order);
  });

  return (
    <>
      <div className="space-y-4">
        {Object.entries(groupedOrders).map(([codigo, ordersInGroup]) => (
          <div key={codigo} className="border rounded-lg overflow-hidden">
            {/* Order Group Header */}
            <div className="bg-muted/30 p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-sm">
                    {codigo.startsWith('OM-') ? codigo : `ID: ${codigo.slice(0, 8)}`}
                  </Badge>
                  <Badge 
                    variant={ordersInGroup[0].estado === 'activa' ? 'default' : 'secondary'}
                  >
                    {ordersInGroup[0].estado === 'activa' ? 'Activa' : 
                     ordersInGroup[0].estado === 'cerrada' ? 'Cerrada' : 'Cancelada'}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(ordersInGroup[0].created_at), 'dd/MM/yyyy', { locale: es })}
                </span>
              </div>
            </div>

            {/* Orders in this group (multiple specialists) */}
            <Accordion type="multiple" className="w-full">
              {ordersInGroup.map((order) => {
                const sessions = allSessions?.[order.id] || [];
                const completedCount = sessions.filter(s => 
                  s.estado === 'completada' || s.estado === 'plan_casero'
                ).length;

                return (
                  <AccordionItem key={order.id} value={order.id} className="border-b last:border-0">
                    <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/20">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <span className={`badge-especialidad badge-${order.especialidad.replace('_', '-')}`}>
                            {ESPECIALIDAD_LABELS[order.especialidad as Especialidad]}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {order.therapist?.nombre_completo || 'Sin terapeuta'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${getProgressColor(completedCount, order.total_sesiones)}`}
                                style={{ width: `${(completedCount / order.total_sesiones) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {completedCount}/{order.total_sesiones}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {order.ubicacion === 'domiciliaria' ? (
                              <><Home className="h-3 w-3 mr-1" /> Dom</>
                            ) : (
                              <><Building2 className="h-3 w-3 mr-1" /> Int</>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {/* Initial Evaluation Status */}
                      {(() => {
                        const hasInitialEval = !!initialEvaluations?.[order.id];
                        return (
                          <div className="flex items-center justify-between mb-4 p-3 bg-muted/20 rounded-md">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Evaluación Inicial</span>
                            </div>
                            {hasInitialEval ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrderId(order.id);
                                  setShowInitialEvalDialog(true);
                                }}
                                className="gap-1"
                              >
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                Ver Evaluación
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-orange-500 border-orange-500">
                                Pendiente
                              </Badge>
                            )}
                          </div>
                        );
                      })()}

                      {/* Diagnosis */}
                      {order.diagnostico && (
                        <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted/20 rounded-md">
                          <span className="font-medium">Diagnóstico:</span> {order.diagnostico}
                        </p>
                      )}
                      
                      {/* Sessions Grid */}
                      {loadingSessions ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : sessions.length > 0 ? (
                        <div className="grid gap-2">
                          {sessions.map((session) => {
                            const hasEvolution = session.evolutions && Array.isArray(session.evolutions) && session.evolutions.length > 0;
                            
                            return (
                              <div 
                                key={session.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {getStatusIcon(session.estado)}
                                  <div>
                                    <span className="font-medium">
                                      Sesión #{session.numero_sesion}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(session.fecha_programada), 'dd/MM/yyyy', { locale: es })}
                                      <Clock className="h-3 w-3 ml-1" />
                                      {session.hora_inicio?.slice(0, 5)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={
                                      session.estado === 'completada' ? 'default' :
                                      session.estado === 'plan_casero' ? 'secondary' :
                                      session.estado === 'cancelada' ? 'destructive' :
                                      'outline'
                                    }
                                    className="text-xs"
                                  >
                                    {ESTADO_SESION_LABELS[session.estado as keyof typeof ESTADO_SESION_LABELS]}
                                  </Badge>
                                  {hasEvolution ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewEvolution(session.id)}
                                            className="gap-1"
                                          >
                                            <Eye className="h-3 w-3" />
                                            <span className="hidden sm:inline">Ver Evolución</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Ver evolución clínica</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    (session.estado === 'completada' || session.estado === 'plan_casero') && (
                                      <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">
                                        Sin evolución
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No hay sesiones programadas
                        </p>
                      )}

                      {/* Package PDF Download (only when all sessions complete) */}
                      {sessions.length > 0 && order.sesiones_completadas === order.total_sesiones && (
                        <div className="mt-4 pt-4 border-t">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={async () => {
                                    try {
                                      const response = await supabase.functions.invoke('generate-evolution-pdf', {
                                        body: { orderId: order.id },
                                      });
                                      
                                      if (response.error) throw response.error;
                                      
                                      const blob = new Blob([response.data], { type: 'text/html' });
                                      const url = URL.createObjectURL(blob);
                                      const printWindow = window.open(url, '_blank');
                                      if (printWindow) {
                                        printWindow.onload = () => printWindow.print();
                                      }
                                      
                                      toast({
                                        title: 'PDF generado',
                                        description: 'Se ha abierto una ventana para imprimir/guardar como PDF',
                                      });
                                    } catch (error: any) {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Error al generar PDF',
                                        description: error.message,
                                      });
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                  Descargar PDF Completo del Paquete
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Incluye evaluación inicial y todas las evoluciones
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        ))}
      </div>

      {/* Evolution Dialog */}
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

      {/* Initial Evaluation Dialog */}
      <InitialEvaluationDialog
        open={showInitialEvalDialog}
        onClose={() => {
          setShowInitialEvalDialog(false);
          setSelectedOrderId(null);
        }}
        orderId={selectedOrderId}
        onSuccess={() => {
          refetch();
        }}
      />
    </>
  );
}