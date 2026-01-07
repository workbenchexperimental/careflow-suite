import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Save, User, DollarSign, Building, Home } from 'lucide-react';
import { ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';

interface TherapistWithRates {
  id: string;
  nombre_completo: string;
  especialidad: Especialidad;
  activo: boolean;
  rates: {
    id?: string;
    es_por_hora: boolean;
    valor_sesion: number | null;
    valor_hora: number | null;
    valor_sesion_domiciliaria: number | null;
    valor_hora_domiciliaria: number | null;
  } | null;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [editingRates, setEditingRates] = useState<Record<string, TherapistWithRates['rates']>>({});

  // Fetch therapists with their rates
  const { data: therapists, isLoading } = useQuery({
    queryKey: ['therapists-with-rates'],
    queryFn: async () => {
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('therapist_profiles')
        .select('id, nombre_completo, especialidad, activo')
        .eq('activo', true)
        .order('nombre_completo');

      if (therapistsError) throw therapistsError;

      const { data: ratesData, error: ratesError } = await supabase
        .from('therapist_rates')
        .select('*')
        .eq('activo', true);

      if (ratesError) throw ratesError;

      // Map rates to therapists
      const result: TherapistWithRates[] = therapistsData.map((therapist) => {
        const rate = ratesData?.find(
          (r) => r.therapist_id === therapist.id && r.especialidad === therapist.especialidad
        );
        return {
          ...therapist,
          rates: rate
            ? {
                id: rate.id,
                es_por_hora: rate.es_por_hora,
                valor_sesion: rate.valor_sesion ? Number(rate.valor_sesion) : null,
                valor_hora: rate.valor_hora ? Number(rate.valor_hora) : null,
                valor_sesion_domiciliaria: rate.valor_sesion_domiciliaria ? Number(rate.valor_sesion_domiciliaria) : null,
                valor_hora_domiciliaria: rate.valor_hora_domiciliaria ? Number(rate.valor_hora_domiciliaria) : null,
              }
            : null,
        };
      });

      return result;
    },
  });

  // Save rates mutation
  const saveRatesMutation = useMutation({
    mutationFn: async ({
      therapistId,
      especialidad,
      rates,
    }: {
      therapistId: string;
      especialidad: Especialidad;
      rates: TherapistWithRates['rates'];
    }) => {
      if (!rates) return;

      const rateData = {
        therapist_id: therapistId,
        especialidad,
        es_por_hora: rates.es_por_hora,
        valor_sesion: rates.valor_sesion,
        valor_hora: rates.valor_hora,
        valor_sesion_domiciliaria: rates.valor_sesion_domiciliaria,
        valor_hora_domiciliaria: rates.valor_hora_domiciliaria,
        activo: true,
      };

      if (rates.id) {
        // Update existing rate
        const { error } = await supabase
          .from('therapist_rates')
          .update(rateData)
          .eq('id', rates.id);
        if (error) throw error;
      } else {
        // Insert new rate
        const { error } = await supabase.from('therapist_rates').insert(rateData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapists-with-rates'] });
      toast.success('Tarifas guardadas correctamente');
    },
    onError: (error) => {
      toast.error('Error al guardar tarifas: ' + error.message);
    },
  });

  const handleRateChange = (therapistId: string, field: string, value: number | boolean | null) => {
    setEditingRates((prev) => ({
      ...prev,
      [therapistId]: {
        ...(prev[therapistId] || therapists?.find((t) => t.id === therapistId)?.rates || {
          es_por_hora: false,
          valor_sesion: null,
          valor_hora: null,
          valor_sesion_domiciliaria: null,
          valor_hora_domiciliaria: null,
        }),
        [field]: value,
      },
    }));
  };

  const getCurrentRates = (therapist: TherapistWithRates) => {
    return editingRates[therapist.id] || therapist.rates || {
      es_por_hora: false,
      valor_sesion: null,
      valor_hora: null,
      valor_sesion_domiciliaria: null,
      valor_hora_domiciliaria: null,
    };
  };

  const handleSave = (therapist: TherapistWithRates) => {
    const rates = getCurrentRates(therapist);
    saveRatesMutation.mutate({
      therapistId: therapist.id,
      especialidad: therapist.especialidad,
      rates: {
        ...rates,
        id: therapist.rates?.id,
      },
    });
    // Clear editing state for this therapist
    setEditingRates((prev) => {
      const newState = { ...prev };
      delete newState[therapist.id];
      return newState;
    });
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '';
    return value.toString();
  };

  const parseCurrency = (value: string): number | null => {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración de Tarifas</h1>
          <p className="text-sm text-muted-foreground">
            Configure las tarifas de pago para cada terapeuta
          </p>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span>Intramural: Sesiones en el centro</span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span>Domiciliaria: Sesiones a domicilio</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Therapist Rate Cards */}
      <div className="grid gap-4">
        {therapists?.map((therapist) => {
          const rates = getCurrentRates(therapist);
          const hasChanges = editingRates[therapist.id] !== undefined;

          return (
            <Card key={therapist.id} className={hasChanges ? 'ring-2 ring-primary/50' : ''}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{therapist.nombre_completo}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {ESPECIALIDAD_LABELS[therapist.especialidad]}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSave(therapist)}
                    disabled={saveRatesMutation.isPending}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Type Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tipo de pago</Label>
                    <p className="text-sm text-muted-foreground">
                      {rates.es_por_hora ? 'Pago por hora trabajada' : 'Pago por sesión completada'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Por sesión</span>
                    <Switch
                      checked={rates.es_por_hora}
                      onCheckedChange={(checked) =>
                        handleRateChange(therapist.id, 'es_por_hora', checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">Por hora</span>
                  </div>
                </div>

                <Separator />

                {/* Rate Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Intramural */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building className="h-4 w-4" />
                      Intramural
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${therapist.id}-valor_sesion`}>Valor por Sesión</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`${therapist.id}-valor_sesion`}
                            type="number"
                            placeholder="0"
                            className="pl-9"
                            value={formatCurrency(rates.valor_sesion)}
                            onChange={(e) =>
                              handleRateChange(
                                therapist.id,
                                'valor_sesion',
                                parseCurrency(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${therapist.id}-valor_hora`}>Valor por Hora</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`${therapist.id}-valor_hora`}
                            type="number"
                            placeholder="0"
                            className="pl-9"
                            value={formatCurrency(rates.valor_hora)}
                            onChange={(e) =>
                              handleRateChange(
                                therapist.id,
                                'valor_hora',
                                parseCurrency(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Domiciliaria */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Home className="h-4 w-4" />
                      Domiciliaria
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${therapist.id}-valor_sesion_domi`}>Valor por Sesión</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`${therapist.id}-valor_sesion_domi`}
                            type="number"
                            placeholder="0"
                            className="pl-9"
                            value={formatCurrency(rates.valor_sesion_domiciliaria)}
                            onChange={(e) =>
                              handleRateChange(
                                therapist.id,
                                'valor_sesion_domiciliaria',
                                parseCurrency(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${therapist.id}-valor_hora_domi`}>Valor por Hora</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id={`${therapist.id}-valor_hora_domi`}
                            type="number"
                            placeholder="0"
                            className="pl-9"
                            value={formatCurrency(rates.valor_hora_domiciliaria)}
                            onChange={(e) =>
                              handleRateChange(
                                therapist.id,
                                'valor_hora_domiciliaria',
                                parseCurrency(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!therapist.rates && (
                  <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                    ⚠️ Este terapeuta no tiene tarifas configuradas. Configure sus tarifas para incluirlo en la nómina.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!therapists || therapists.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay terapeutas activos</h3>
            <p className="text-sm text-muted-foreground">
              Agregue terapeutas desde el módulo de Talento Humano
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
