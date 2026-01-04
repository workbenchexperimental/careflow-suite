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
import { formatearEdad } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PatientFormDialog from '@/components/patients/PatientFormDialog';
import PatientDocuments from '@/components/patients/PatientDocuments';
import OrderSessionsAccordion from '@/components/patients/OrderSessionsAccordion';

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

  // Fetch medical orders count
  const { data: ordersCount } = useQuery({
    queryKey: ['patient-orders-count', id],
    queryFn: async () => {
      if (!id) return 0;
      const { count, error } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', id);
      if (error) throw error;
      return count || 0;
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

      {/* Tabs for Orders/Sessions and Documents */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="orders" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Órdenes y Sesiones</span>
            <Badge variant="secondary" className="ml-1">{ordersCount || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Medical Orders with Sessions Tab */}
        <TabsContent value="orders">
          <Card className="card-clinical">
            <CardHeader>
              <CardTitle>Órdenes Médicas y Sesiones</CardTitle>
              <CardDescription>
                Haga clic en una orden para ver sus sesiones y evoluciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderSessionsAccordion patientId={id!} />
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
