import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  File,
  FileImage,
  FileIcon,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface PatientDocumentsProps {
  patientId: string;
}

const DOCUMENT_TYPES = [
  { value: 'orden_medica', label: 'Orden Médica' },
  { value: 'diagnostico', label: 'Diagnóstico' },
  { value: 'examen', label: 'Examen' },
  { value: 'imagen', label: 'Imagen Diagnóstica' },
  { value: 'consentimiento', label: 'Consentimiento' },
  { value: 'otro', label: 'Otro' },
];

export default function PatientDocuments({ patientId }: PatientDocumentsProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !documentName || !documentType || !user) {
        throw new Error('Faltan datos requeridos');
      }

      setUploading(true);

      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('patient-documents')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('patient-documents')
        .getPublicUrl(fileName);

      // Insert record
      const { error: insertError } = await supabase
        .from('patient_documents')
        .insert({
          patient_id: patientId,
          nombre: documentName,
          tipo: documentType,
          file_url: fileName,
          file_type: selectedFile.type,
          uploaded_by: user.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Documento subido exitosamente');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      handleCloseUpload();
    },
    onError: (error: Error) => {
      toast.error('Error al subir documento: ' + error.message);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const doc = documents?.find(d => d.id === docId);
      if (!doc) throw new Error('Documento no encontrado');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('patient-documents')
        .remove([doc.file_url]);

      if (storageError) console.warn('Error deleting file from storage:', storageError);

      // Delete record
      const { error: deleteError } = await supabase
        .from('patient_documents')
        .delete()
        .eq('id', docId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Documento eliminado');
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
    },
    onError: (error: Error) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleCloseUpload = () => {
    setIsUploadOpen(false);
    setSelectedFile(null);
    setDocumentName('');
    setDocumentType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('patient-documents')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Error al descargar el documento');
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (fileType?.startsWith('image/')) return FileImage;
    if (fileType?.includes('pdf')) return FileText;
    return FileIcon;
  };

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <Card className="card-clinical">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Documentos del Paciente</CardTitle>
            <CardDescription>Órdenes médicas, diagnósticos y documentos adjuntos</CardDescription>
          </div>
          <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Subir Documento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => {
              const IconComponent = getFileIcon(doc.file_type);
              return (
                <div key={doc.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.nombre}</p>
                      <p className="text-sm text-muted-foreground">{getTypeLabel(doc.tipo)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(doc.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => handleDownload(doc.file_url, doc.nombre)}
                    >
                      <Download className="h-3 w-3" />
                      Descargar
                    </Button>
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <File className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay documentos adjuntos</p>
            <Button 
              variant="outline" 
              className="mt-4 gap-2"
              onClick={() => setIsUploadOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Subir primer documento
            </Button>
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subir Documento</DialogTitle>
            <DialogDescription>
              Adjunta un documento al historial del paciente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Archivo</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                />
              </div>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-name">Nombre del documento</Label>
              <Input
                id="doc-name"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Ej: Orden médica - Enero 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseUpload} disabled={uploading}>
              Cancelar
            </Button>
            <Button 
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || !documentName || !documentType || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
