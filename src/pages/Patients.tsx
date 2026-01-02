import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Users, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Phone,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatearEdad } from '@/types/database';
import PatientFormDialog from '@/components/patients/PatientFormDialog';

export default function Patients() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: patients, isLoading, refetch } = useQuery({
    queryKey: ['patients', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`nombre_completo.ilike.%${searchTerm}%,cedula.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (patientId: string) => {
    setSelectedPatient(patientId);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedPatient(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">
            Gestión de pacientes y sus datos demográficos
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Paciente
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
                placeholder="Buscar por nombre o cédula..."
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

      {/* Tabla de pacientes */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lista de Pacientes
          </CardTitle>
          <CardDescription>
            {patients?.length || 0} pacientes registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : patients && patients.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>EPS</TableHead>
                    <TableHead>Acudiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        {patient.nombre_completo}
                      </TableCell>
                      <TableCell>{patient.cedula || '-'}</TableCell>
                      <TableCell>
                        {formatearEdad(patient.fecha_nacimiento)}
                      </TableCell>
                      <TableCell>{patient.eps || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{patient.acudiente_nombre}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {patient.acudiente_telefono}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={patient.activo ? 'default' : 'secondary'}>
                          {patient.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/patients/${patient.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Perfil
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem onClick={() => handleEdit(patient.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
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
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No hay pacientes registrados</p>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2"
                  onClick={() => setIsFormOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Agregar primer paciente
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de formulario */}
      <PatientFormDialog
        open={isFormOpen}
        onClose={handleCloseForm}
        patientId={selectedPatient}
        onSuccess={() => {
          handleCloseForm();
          refetch();
        }}
      />
    </div>
  );
}