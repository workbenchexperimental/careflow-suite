import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  Calendar, 
  FileText, 
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { ESPECIALIDAD_LABELS, Especialidad, TherapistProfile } from '@/types/database';

export default function Dashboard() {
  const { isAdmin, isTherapist, profile } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? 'Panel de Administración' : 'Mi Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin 
            ? 'Resumen general del sistema de gestión clínica'
            : `Bienvenido, ${(profile as TherapistProfile)?.nombre_completo || 'Terapeuta'}`
          }
        </p>
      </div>

      {/* Estadísticas principales */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pacientes Activos
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                +0% respecto al mes anterior
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sesiones Hoy
              </CardTitle>
              <Calendar className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                0 completadas, 0 pendientes
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Órdenes Activas
              </CardTitle>
              <FileText className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                0 próximas a cerrar
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas de Fuga
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Pacientes sin atención +7 días
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dashboard del terapeuta */}
      {isTherapist && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sesiones Hoy
              </CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                0 pendientes de atención
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Esta Semana
              </CardTitle>
              <Clock className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                sesiones programadas
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completadas
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                este mes
              </p>
            </CardContent>
          </Card>

          <Card className="card-clinical">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Canceladas
              </CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                este mes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contenido adicional */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Agenda del día */}
        <Card className="card-clinical">
          <CardHeader>
            <CardTitle className="text-lg">
              {isAdmin ? 'Sesiones de Hoy' : 'Mi Agenda de Hoy'}
            </CardTitle>
            <CardDescription>
              Vista rápida de las sesiones programadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                No hay sesiones programadas para hoy
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Las sesiones aparecerán aquí cuando se creen órdenes médicas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente o alertas */}
        <Card className="card-clinical">
          <CardHeader>
            <CardTitle className="text-lg">
              {isAdmin ? 'Actividad Reciente' : 'Mis Pacientes'}
            </CardTitle>
            <CardDescription>
              {isAdmin 
                ? 'Últimas acciones en el sistema'
                : 'Pacientes con tratamientos activos'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                {isAdmin 
                  ? 'No hay actividad reciente'
                  : 'No tiene pacientes asignados'
                }
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {isAdmin
                  ? 'Las acciones del sistema aparecerán aquí'
                  : 'Los pacientes aparecerán cuando se le asignen órdenes'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info de especialidad para terapeutas */}
      {isTherapist && profile && (
        <Card className="card-clinical bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Especialidad: {ESPECIALIDAD_LABELS[(profile as TherapistProfile).especialidad as Especialidad]}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Recuerde mantener actualizada su firma digital en su perfil
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}