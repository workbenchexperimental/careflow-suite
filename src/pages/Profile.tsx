import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Upload, 
  Image as ImageIcon,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { TherapistProfile, AdminProfile, ESPECIALIDAD_LABELS, Especialidad } from '@/types/database';
import { Separator } from '@/components/ui/separator';

export default function Profile() {
  const { user, role, profile, isTherapist, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const therapistProfile = isTherapist ? (profile as TherapistProfile) : null;
  const adminProfile = !isTherapist ? (profile as AdminProfile) : null;

  const uploadSignature = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('No autenticado');

      setIsUploading(true);

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Solo se permiten archivos de imagen');
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('El archivo no debe superar 2MB');
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/signature.${fileExt}`;

      // Subir archivo
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath);

      // Actualizar perfil con la URL de la firma
      const { error: updateError } = await supabase
        .from('therapist_profiles')
        .update({ firma_digital_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      return urlData.publicUrl;
    },
    onSuccess: () => {
      toast({
        title: 'Firma actualizada',
        description: 'Su firma digital ha sido guardada correctamente',
      });
      refreshProfile();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error al subir firma',
        description: error.message,
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadSignature.mutate(file);
    }
  };

  const currentProfile = therapistProfile || adminProfile;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Información de su cuenta y configuración personal
        </p>
      </div>

      {/* Información del perfil */}
      <Card className="card-clinical">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle>{currentProfile?.nombre_completo || 'Usuario'}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Shield className="h-4 w-4" />
                {role === 'admin' 
                  ? 'Administrador' 
                  : ESPECIALIDAD_LABELS[therapistProfile?.especialidad as Especialidad]
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Correo Electrónico
              </Label>
              <Input value={currentProfile?.email || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                Cédula
              </Label>
              <Input value={currentProfile?.cedula || ''} disabled />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                Teléfono
              </Label>
              <Input value={currentProfile?.telefono || 'No registrado'} disabled />
            </div>

            {isTherapist && therapistProfile && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Especialidad</Label>
                <Input 
                  value={ESPECIALIDAD_LABELS[therapistProfile.especialidad as Especialidad]} 
                  disabled 
                />
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Para modificar sus datos personales, contacte al administrador del sistema.
          </p>
        </CardContent>
      </Card>

      {/* Firma digital (solo para terapeutas) */}
      {isTherapist && (
        <Card className="card-clinical">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Firma Digital
            </CardTitle>
            <CardDescription>
              Su firma aparecerá automáticamente en las evoluciones clínicas y reportes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {therapistProfile?.firma_digital_url ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <img 
                    src={therapistProfile.firma_digital_url} 
                    alt="Firma digital"
                    className="max-h-24 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  Firma digital configurada
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">
                  No tiene una firma digital configurada
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Suba una imagen de su firma para usarla en documentos
                </p>
              </div>
            )}

            <Separator />

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {therapistProfile?.firma_digital_url ? 'Cambiar firma' : 'Subir firma'}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos permitidos: PNG, JPG. Tamaño máximo: 2MB
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de sesión */}
      <Card className="card-clinical">
        <CardHeader>
          <CardTitle>Información de Sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID de Usuario</span>
            <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Último acceso</span>
            <span>
              {currentProfile?.last_login 
                ? new Date(currentProfile.last_login).toLocaleString('es-CO')
                : 'Primera sesión'
              }
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}