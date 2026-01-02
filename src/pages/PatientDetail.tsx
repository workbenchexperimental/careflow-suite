import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileText,
  ClipboardList,
  Activity,
  Users,
  Building2,
  Edit,
} from 'lucide-react';
import { formatearEdad, ESPECIALIDAD_LABELS, ESTADO_SESION_LABELS, UBICACION_LABELS } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PatientFormDialog from '@/components/patients/PatientFormDialog';
import PatientDocuments from '@/components/patients/PatientDocuments';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Fetch patient data
  const { data: patient, isLoading: loadingPatient, refetch: refetchPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch medical orders with therapist info
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ['patient-orders', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          *,
          therapist:therapist_profiles(nombre_completo, especialidad)
        `)
        .eq('patient_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch sessions with evolutions
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['patient-sessions', id],
    queryFn: async () => {
      if (!id) return [];
      const { data: ordersData, error: ordersError } = await supabase
        .from('medical_orders')
        .select('id')
        .eq('patient_id', id);
      
      if (ordersError) throw ordersError;
      if (!ordersData || ordersData.length === 0) return [];

      const orderIds = ordersData.map(o => o.id);
      
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          medical_order:medical_orders(
            especialidad,
            therapist:therapist_profiles(nombre_completo)
          ),
          evolutions(id, contenido, es_cierre, created_at)
        `)
        .in('medical_order_id', orderIds)
        .order('fecha_programada', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/patients')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Volver a Pacientes
        </Button>
        <Card className="card-clinical">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">Paciente no encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sexoLabel = patient.sexo === 'masculino' ? 'Masculino' : patient.sexo === 'femenino' ? 'Femenino' : 'Otro';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/patients')} size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{patient.nombre_completo}</h1>
            <p className="text-muted-foreground">
              Historial Clínico Completo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={patient.activo ? 'default' : 'secondary'} className="text-sm">
            {patient.activo ? 'Activo' : 'Inactivo'}
          </Badge>
          {isAdmin && (
            <Button variant="outline" onClick={() => setIsEditOpen(true)} className="gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Patient Info Card */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Datos del Paciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cédula</p>
              <p className="font-medium">{patient.cedula || 'No registrada'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fecha de Nacimiento</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(patient.fecha_nacimiento), 'dd/MM/yyyy', { locale: es })}
                <span className="text-muted-foreground">({formatearEdad(patient.fecha_nacimiento)})</span>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sexo</p>
              <p className="font-medium">{sexoLabel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Teléfono</p>
              <p className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {patient.telefono || 'No registrado'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {patient.email || 'No registrado'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ocupación</p>
              <p className="font-medium">{patient.ocupacion || 'No registrada'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">EPS</p>
              <p className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {patient.eps || 'No registrada'}
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm text-muted-foreground">Dirección</p>
              <p className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {patient.direccion || 'No registrada'} {patient.ciudad && `- ${patient.ciudad}`}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Guardian Info */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Información del Acudiente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{patient.acudiente_nombre}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Parentesco</p>
                <p className="font-medium">{patient.acudiente_parentesco}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {patient.acudiente_telefono}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Orders, Sessions, Documents */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="orders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Órdenes</span>
            <Badge variant="secondary" className="ml-1">{orders?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Sesiones</span>
            <Badge variant="secondary" className="ml-1">{sessions?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Medical Orders Tab */}
        <TabsContent value="orders">
          <Card className="card-clinical">
            <CardHeader>
              <CardTitle>Órdenes Médicas</CardTitle>
              <CardDescription>Historial de órdenes de terapia del paciente</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                        <Badge variant={order.estado === 'activa' ? 'default' : order.estado === 'cerrada' ? 'secondary' : 'outline'}>
                            {order.estado === 'activa' ? 'Activa' : order.estado === 'cerrada' ? 'Cerrada' : 'Cancelada'}
                          </Badge>
                          <h4 className="font-medium mt-2">
                            {ESPECIALIDAD_LABELS[order.especialidad as keyof typeof ESPECIALIDAD_LABELS] || order.especialidad}
                          </h4>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{format(new Date(order.created_at), 'dd/MM/yyyy', { locale: es })}</p>
                          <p className="font-medium text-foreground">
                            {order.sesiones_completadas}/{order.total_sesiones} sesiones
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">Terapeuta:</span>
                        <span>{order.therapist?.nombre_completo || 'No asignado'}</span>
                        <Badge variant="outline">
                          {UBICACION_LABELS[order.ubicacion as keyof typeof UBICACION_LABELS] || order.ubicacion}
                        </Badge>
                      </div>
                      {order.diagnostico && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Diagnóstico:</span> {order.diagnostico}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No hay órdenes médicas registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card className="card-clinical">
            <CardHeader>
              <CardTitle>Timeline de Sesiones</CardTitle>
              <CardDescription>Historial de sesiones y evoluciones clínicas</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {sessions.map((session, index) => (
                    <div key={session.id} className="relative pl-10 pb-6 last:pb-0">
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                        session.estado === 'completada' ? 'bg-green-500 border-green-500' :
                        session.estado === 'cancelada' ? 'bg-red-500 border-red-500' :
                        session.estado === 'plan_casero' ? 'bg-blue-500 border-blue-500' :
                        'bg-background border-primary'
                      }`} />
                      
                      <div className="border rounded-lg p-4 bg-card">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">
                              Sesión #{session.numero_sesion}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(session.fecha_programada), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                              {' • '}
                              {session.hora_inicio?.slice(0, 5)}
                            </p>
                          </div>
                          <Badge variant={
                            session.estado === 'completada' ? 'default' :
                            session.estado === 'cancelada' ? 'destructive' :
                            session.estado === 'plan_casero' ? 'secondary' :
                            'outline'
                          }>
                            {ESTADO_SESION_LABELS[session.estado as keyof typeof ESTADO_SESION_LABELS] || session.estado}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>{ESPECIALIDAD_LABELS[session.medical_order?.especialidad as keyof typeof ESPECIALIDAD_LABELS]}</span>
                          <span>•</span>
                          <span>{session.medical_order?.therapist?.nombre_completo}</span>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {UBICACION_LABELS[session.ubicacion as keyof typeof UBICACION_LABELS]}
                          </Badge>
                        </div>

                        {/* Evolution */}
                        {session.evolutions && Array.isArray(session.evolutions) && session.evolutions.length > 0 && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Evolución Clínica
                              {session.evolutions[0].es_cierre && (
                                <Badge variant="secondary" className="text-xs ml-2">Cierre</Badge>
                              )}
                            </p>
                            <p className="text-sm line-clamp-3">{session.evolutions[0].contenido}</p>
                          </div>
                        )}

                        {/* Cancellation note */}
                        {session.estado === 'cancelada' && session.notas_cancelacion && (
                          <div className="mt-3 p-3 bg-destructive/10 rounded-md">
                            <p className="text-xs font-medium text-destructive mb-1">Motivo de cancelación</p>
                            <p className="text-sm">{session.notas_cancelacion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No hay sesiones registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <PatientDocuments patientId={id!} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <PatientFormDialog
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        patientId={id}
        onSuccess={() => {
          setIsEditOpen(false);
          refetchPatient();
        }}
      />
    </div>
  );
}
