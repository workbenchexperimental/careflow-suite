import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  UserPlus, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';
import TherapistFormDialog from '@/components/therapists/TherapistFormDialog';

export default function Therapists() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<string | null>(null);

  const { data: therapists, isLoading, refetch } = useQuery({
    queryKey: ['therapists', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('therapist_profiles')
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

  const handleEdit = (therapistId: string) => {
    setSelectedTherapist(therapistId);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedTherapist(null);
  };

  const getEspecialidadBadgeClass = (especialidad: Especialidad) => {
    const classes: Record<Especialidad, string> = {
      fisioterapia: 'badge-fisioterapia',
      fonoaudiologia: 'badge-fonoaudiologia',
      terapia_ocupacional: 'badge-terapia-ocupacional',
      psicologia: 'badge-psicologia',
      terapia_acuatica: 'badge-terapia-acuatica',
    };
    return classes[especialidad] || '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Talento Humano</h1>
          <p className="text-muted-foreground">
            Gestión de terapeutas y profesionales de la salud
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Terapeuta
        </Button>
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

      {/* Tabla de terapeutas */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Lista de Terapeutas
          </CardTitle>
          <CardDescription>
            {therapists?.length || 0} terapeutas registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : therapists && therapists.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {therapists.map((therapist) => (
                    <TableRow key={therapist.id}>
                      <TableCell className="font-medium">
                        {therapist.nombre_completo}
                      </TableCell>
                      <TableCell>{therapist.cedula}</TableCell>
                      <TableCell>
                        <span className={`badge-especialidad ${getEspecialidadBadgeClass(therapist.especialidad as Especialidad)}`}>
                          {ESPECIALIDAD_LABELS[therapist.especialidad as Especialidad]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {therapist.email}
                          </span>
                          {therapist.telefono && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {therapist.telefono}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {therapist.firma_digital_url ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={therapist.activo ? 'default' : 'secondary'}>
                          {therapist.activo ? 'Activo' : 'Inactivo'}
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(therapist.id)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
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
              <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No hay terapeutas registrados</p>
              <Button 
                variant="outline" 
                className="mt-4 gap-2"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Agregar primer terapeuta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de formulario */}
      <TherapistFormDialog
        open={isFormOpen}
        onClose={handleCloseForm}
        therapistId={selectedTherapist}
        onSuccess={() => {
          handleCloseForm();
          refetch();
        }}
      />
    </div>
  );
}