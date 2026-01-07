import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  DollarSign,
  Calculator,
  Lock,
  Download,
  CheckCircle,
  AlertTriangle,
  Calendar,
  RefreshCcw,
} from 'lucide-react';
import { ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';
import { format, startOfMonth, endOfMonth, setMonth, setYear } from 'date-fns';
import { es } from 'date-fns/locale';

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

type EstadoPeriodo = 'abierto' | 'cerrado' | 'pagado';

interface PayrollDetail {
  id: string;
  therapist_id: string;
  therapist_name: string;
  especialidad: Especialidad;
  sesiones_intramural: number;
  sesiones_domiciliaria: number;
  horas_intramural: number;
  horas_domiciliaria: number;
  es_por_hora: boolean;
  tarifa_sesion_intramural: number | null;
  tarifa_sesion_domiciliaria: number | null;
  tarifa_hora_intramural: number | null;
  tarifa_hora_domiciliaria: number | null;
  subtotal_intramural: number;
  subtotal_domiciliaria: number;
  total_bruto: number;
}

export default function Payroll() {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  // Fetch period for selected month/year
  const { data: period, isLoading: periodLoading } = useQuery({
    queryKey: ['payroll-period', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('mes', selectedMonth)
        .eq('anio', selectedYear)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch payroll details for the period
  const { data: payrollDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['payroll-details', period?.id],
    enabled: !!period?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_details')
        .select(`
          *,
          therapist_profiles!inner(nombre_completo, especialidad)
        `)
        .eq('period_id', period!.id);

      if (error) throw error;

      return data.map((d): PayrollDetail => ({
        id: d.id,
        therapist_id: d.therapist_id,
        therapist_name: (d.therapist_profiles as any).nombre_completo,
        especialidad: (d.therapist_profiles as any).especialidad,
        sesiones_intramural: d.sesiones_intramural,
        sesiones_domiciliaria: d.sesiones_domiciliaria,
        horas_intramural: Number(d.horas_intramural),
        horas_domiciliaria: Number(d.horas_domiciliaria),
        es_por_hora: d.es_por_hora,
        tarifa_sesion_intramural: d.tarifa_sesion_intramural ? Number(d.tarifa_sesion_intramural) : null,
        tarifa_sesion_domiciliaria: d.tarifa_sesion_domiciliaria ? Number(d.tarifa_sesion_domiciliaria) : null,
        tarifa_hora_intramural: d.tarifa_hora_intramural ? Number(d.tarifa_hora_intramural) : null,
        tarifa_hora_domiciliaria: d.tarifa_hora_domiciliaria ? Number(d.tarifa_hora_domiciliaria) : null,
        subtotal_intramural: Number(d.subtotal_intramural),
        subtotal_domiciliaria: Number(d.subtotal_domiciliaria),
        total_bruto: Number(d.total_bruto),
      }));
    },
  });

  // Create period mutation
  const createPeriodMutation = useMutation({
    mutationFn: async () => {
      const periodDate = setYear(setMonth(new Date(), selectedMonth - 1), selectedYear);
      const fechaInicio = format(startOfMonth(periodDate), 'yyyy-MM-dd');
      const fechaFin = format(endOfMonth(periodDate), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('payroll_periods')
        .insert({
          mes: selectedMonth,
          anio: selectedYear,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: 'abierto' as EstadoPeriodo,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period'] });
      toast.success('Período creado correctamente');
    },
    onError: (error) => {
      toast.error('Error al crear período: ' + error.message);
    },
  });

  // Calculate payroll mutation
  const calculatePayrollMutation = useMutation({
    mutationFn: async () => {
      if (!period) throw new Error('No hay período seleccionado');
      if (period.estado !== 'abierto') throw new Error('El período está cerrado');

      // Get all sessions in the period
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          fecha_programada,
          hora_inicio,
          hora_fin,
          ubicacion,
          estado,
          medical_orders!inner(therapist_id, especialidad)
        `)
        .gte('fecha_programada', period.fecha_inicio)
        .lte('fecha_programada', period.fecha_fin)
        .in('estado', ['completada', 'plan_casero']);

      if (sessionsError) throw sessionsError;

      // Get all therapist rates
      const { data: rates, error: ratesError } = await supabase
        .from('therapist_rates')
        .select('*')
        .eq('activo', true);

      if (ratesError) throw ratesError;

      // Get therapist profiles
      const { data: therapists, error: therapistsError } = await supabase
        .from('therapist_profiles')
        .select('id, nombre_completo, especialidad')
        .eq('activo', true);

      if (therapistsError) throw therapistsError;

      // Group sessions by therapist
      const therapistSessions: Record<string, typeof sessions> = {};
      sessions?.forEach((session) => {
        const therapistId = (session.medical_orders as any).therapist_id;
        if (!therapistSessions[therapistId]) {
          therapistSessions[therapistId] = [];
        }
        therapistSessions[therapistId].push(session);
      });

      // Delete existing details for this period
      await supabase.from('payroll_details').delete().eq('period_id', period.id);

      // Calculate payroll for each therapist
      const payrollDetailsToInsert = [];
      const warnings: string[] = [];

      for (const therapist of therapists || []) {
        const therapistSessionsList = therapistSessions[therapist.id] || [];
        const rate = rates?.find(
          (r) => r.therapist_id === therapist.id && r.especialidad === therapist.especialidad
        );

        if (!rate && therapistSessionsList.length > 0) {
          warnings.push(`${therapist.nombre_completo} no tiene tarifas configuradas`);
        }

        // Count sessions by location
        const intramural = therapistSessionsList.filter((s) => s.ubicacion === 'intramural');
        const domiciliaria = therapistSessionsList.filter((s) => s.ubicacion === 'domiciliaria');

        // Calculate hours (assuming 1 hour per session if hora_fin not set)
        const calculateHours = (sessionsList: typeof sessions) => {
          return sessionsList?.reduce((total, s) => {
            if (s.hora_inicio && s.hora_fin) {
              const start = new Date(`2000-01-01T${s.hora_inicio}`);
              const end = new Date(`2000-01-01T${s.hora_fin}`);
              return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }
            return total + 1; // Default to 1 hour
          }, 0) || 0;
        };

        const horasIntramural = calculateHours(intramural);
        const horasDomiciliaria = calculateHours(domiciliaria);

        // Calculate subtotals
        let subtotalIntramural = 0;
        let subtotalDomiciliaria = 0;

        if (rate) {
          if (rate.es_por_hora) {
            subtotalIntramural = horasIntramural * (Number(rate.valor_hora) || 0);
            subtotalDomiciliaria = horasDomiciliaria * (Number(rate.valor_hora_domiciliaria) || Number(rate.valor_hora) || 0);
          } else {
            subtotalIntramural = intramural.length * (Number(rate.valor_sesion) || 0);
            subtotalDomiciliaria = domiciliaria.length * (Number(rate.valor_sesion_domiciliaria) || Number(rate.valor_sesion) || 0);
          }
        }

        // Only insert if there are sessions or the therapist has rates configured
        if (therapistSessionsList.length > 0 || rate) {
          payrollDetailsToInsert.push({
            period_id: period.id,
            therapist_id: therapist.id,
            sesiones_intramural: intramural.length,
            sesiones_domiciliaria: domiciliaria.length,
            horas_intramural: horasIntramural,
            horas_domiciliaria: horasDomiciliaria,
            es_por_hora: rate?.es_por_hora || false,
            tarifa_sesion_intramural: rate?.valor_sesion || null,
            tarifa_sesion_domiciliaria: rate?.valor_sesion_domiciliaria || null,
            tarifa_hora_intramural: rate?.valor_hora || null,
            tarifa_hora_domiciliaria: rate?.valor_hora_domiciliaria || null,
            subtotal_intramural: subtotalIntramural,
            subtotal_domiciliaria: subtotalDomiciliaria,
            total_bruto: subtotalIntramural + subtotalDomiciliaria,
          });
        }
      }

      if (payrollDetailsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('payroll_details')
          .insert(payrollDetailsToInsert);

        if (insertError) throw insertError;
      }

      return { warnings };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-details'] });
      if (data.warnings.length > 0) {
        toast.warning(`Nómina calculada con advertencias: ${data.warnings.join(', ')}`);
      } else {
        toast.success('Nómina calculada correctamente');
      }
    },
    onError: (error) => {
      toast.error('Error al calcular nómina: ' + error.message);
    },
  });

  // Close period mutation
  const closePeriodMutation = useMutation({
    mutationFn: async () => {
      if (!period) throw new Error('No hay período seleccionado');

      const { error } = await supabase
        .from('payroll_periods')
        .update({
          estado: 'cerrado' as EstadoPeriodo,
          closed_at: new Date().toISOString(),
        })
        .eq('id', period.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period'] });
      toast.success('Período cerrado correctamente');
    },
    onError: (error) => {
      toast.error('Error al cerrar período: ' + error.message);
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async () => {
      if (!period) throw new Error('No hay período seleccionado');

      const { error } = await supabase
        .from('payroll_periods')
        .update({
          estado: 'pagado' as EstadoPeriodo,
          paid_at: new Date().toISOString(),
        })
        .eq('id', period.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period'] });
      toast.success('Período marcado como pagado');
    },
    onError: (error) => {
      toast.error('Error al marcar como pagado: ' + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (estado: EstadoPeriodo) => {
    switch (estado) {
      case 'abierto':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Abierto</Badge>;
      case 'cerrado':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Cerrado</Badge>;
      case 'pagado':
        return <Badge className="bg-green-600">Pagado</Badge>;
      default:
        return null;
    }
  };

  const totals = useMemo(() => {
    if (!payrollDetails) return { intramural: 0, domiciliaria: 0, total: 0 };
    return payrollDetails.reduce(
      (acc, d) => ({
        intramural: acc.intramural + d.subtotal_intramural,
        domiciliaria: acc.domiciliaria + d.subtotal_domiciliaria,
        total: acc.total + d.total_bruto,
      }),
      { intramural: 0, domiciliaria: 0, total: 0 }
    );
  }, [payrollDetails]);

  const exportToCSV = () => {
    if (!payrollDetails) return;

    const headers = ['Terapeuta', 'Especialidad', 'Sesiones Intra', 'Sesiones Domi', 'Subtotal Intra', 'Subtotal Domi', 'Total'];
    const rows = payrollDetails.map((d) => [
      d.therapist_name,
      ESPECIALIDAD_LABELS[d.especialidad],
      d.sesiones_intramural,
      d.sesiones_domiciliaria,
      d.subtotal_intramural,
      d.subtotal_domiciliaria,
      d.total_bruto,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nomina_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  const isLoading = periodLoading || detailsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nómina</h1>
          <p className="text-sm text-muted-foreground">
            Liquidación de pagos a terapeutas
          </p>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
            </div>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(v) => setSelectedMonth(parseInt(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {period && (
              <div className="flex items-center gap-2 ml-4">
                {getStatusBadge(period.estado as EstadoPeriodo)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(period.fecha_inicio), 'dd/MM')} - {format(new Date(period.fecha_fin), 'dd/MM/yyyy')}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {!period && (
          <Button
            onClick={() => createPeriodMutation.mutate()}
            disabled={createPeriodMutation.isPending}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Crear Período
          </Button>
        )}
        {period?.estado === 'abierto' && (
          <>
            <Button
              onClick={() => calculatePayrollMutation.mutate()}
              disabled={calculatePayrollMutation.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              {payrollDetails?.length ? 'Recalcular Nómina' : 'Calcular Nómina'}
            </Button>
            <Button
              variant="outline"
              onClick={() => closePeriodMutation.mutate()}
              disabled={closePeriodMutation.isPending || !payrollDetails?.length}
            >
              <Lock className="h-4 w-4 mr-2" />
              Cerrar Período
            </Button>
          </>
        )}
        {period?.estado === 'cerrado' && (
          <Button
            onClick={() => markAsPaidMutation.mutate()}
            disabled={markAsPaidMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Marcar como Pagado
          </Button>
        )}
        {payrollDetails?.length ? (
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        ) : null}
      </div>

      {/* Alerts */}
      {period?.estado === 'cerrado' && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Este período está cerrado. No se pueden hacer modificaciones a la nómina.
          </AlertDescription>
        </Alert>
      )}

      {period?.estado === 'pagado' && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Este período ha sido pagado el {period.paid_at ? format(new Date(period.paid_at), "dd 'de' MMMM 'de' yyyy", { locale: es }) : ''}.
          </AlertDescription>
        </Alert>
      )}

      {/* Payroll Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </CardContent>
        </Card>
      ) : !period ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No existe período para este mes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cree un período para comenzar a calcular la nómina
            </p>
          </CardContent>
        </Card>
      ) : !payrollDetails?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nómina no calculada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Calcule la nómina para ver los detalles de pago
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Nómina</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terapeuta</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead className="text-center">Sesiones Intra</TableHead>
                    <TableHead className="text-center">Sesiones Domi</TableHead>
                    <TableHead className="text-right">Subtotal Intra</TableHead>
                    <TableHead className="text-right">Subtotal Domi</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell className="font-medium">{detail.therapist_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ESPECIALIDAD_LABELS[detail.especialidad]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{detail.sesiones_intramural}</TableCell>
                      <TableCell className="text-center">{detail.sesiones_domiciliaria}</TableCell>
                      <TableCell className="text-right">{formatCurrency(detail.subtotal_intramural)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(detail.subtotal_domiciliaria)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(detail.total_bruto)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>TOTAL NÓMINA</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.intramural)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.domiciliaria)}</TableCell>
                    <TableCell className="text-right text-lg">{formatCurrency(totals.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
