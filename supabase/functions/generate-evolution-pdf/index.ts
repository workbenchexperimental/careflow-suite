import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple PDF generation using text-based format
function generatePDFContent(data: {
  evolution: any;
  session: any;
  patient: any;
  therapist: any;
  order: any;
}): string {
  const { evolution, session, patient, therapist, order } = data;
  
  const fechaSesion = new Date(session.fecha_programada).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const fechaEvolucion = new Date(evolution.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const especialidadLabels: Record<string, string> = {
    fisioterapia: 'Fisioterapia',
    fonoaudiologia: 'Fonoaudiología',
    terapia_ocupacional: 'Terapia Ocupacional',
    psicologia: 'Psicología',
    terapia_acuatica: 'Terapia Acuática',
  };

  // Calculate age
  const birthDate = new Date(patient.fecha_nacimiento);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Build HTML content for PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      background-color: #f0f9ff;
      padding: 8px 12px;
      border-left: 4px solid #2563eb;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 12px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .info-item {
      padding: 5px 0;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 11px;
    }
    .info-value {
      color: #333;
    }
    .content-box {
      background-color: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 15px;
      margin-top: 10px;
    }
    .signature-section {
      margin-top: 50px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #333;
      width: 250px;
      margin: 0 auto;
      padding-top: 10px;
    }
    .signature-image {
      max-height: 60px;
      margin-bottom: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10px;
      color: #999;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    .badge {
      display: inline-block;
      background-color: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .closure-section {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 15px;
      margin-top: 20px;
    }
    .closure-title {
      color: #b45309;
      font-weight: bold;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVOLUCIÓN CLÍNICA</h1>
    <p>Sesión #${session.numero_sesion} ${evolution.es_cierre ? '- CIERRE DE TRATAMIENTO' : ''}</p>
    <p>${fechaSesion}</p>
  </div>

  <div class="section">
    <div class="section-title">DATOS DEL PACIENTE</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nombre Completo</div>
        <div class="info-value">${patient.nombre_completo}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Identificación</div>
        <div class="info-value">${patient.cedula || 'No registrada'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Edad</div>
        <div class="info-value">${age} años</div>
      </div>
      <div class="info-item">
        <div class="info-label">Fecha de Nacimiento</div>
        <div class="info-value">${new Date(patient.fecha_nacimiento).toLocaleDateString('es-CO')}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">INFORMACIÓN DE LA ORDEN MÉDICA</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Especialidad</div>
        <div class="info-value"><span class="badge">${especialidadLabels[order.especialidad] || order.especialidad}</span></div>
      </div>
      <div class="info-item">
        <div class="info-label">Sesión</div>
        <div class="info-value">${session.numero_sesion} de ${order.total_sesiones}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Ubicación</div>
        <div class="info-value">${session.ubicacion === 'intramural' ? 'Intramural' : 'Domiciliaria'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Hora</div>
        <div class="info-value">${session.hora_inicio}</div>
      </div>
    </div>
    ${order.diagnostico ? `
    <div class="content-box">
      <div class="info-label">Diagnóstico</div>
      <div class="info-value">${order.diagnostico}</div>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">${session.numero_sesion === 1 ? 'EVALUACIÓN INICIAL' : 'EVOLUCIÓN DE LA SESIÓN'}</div>
    <div class="content-box">
      ${evolution.contenido}
    </div>
  </div>

  ${evolution.procedimientos ? `
  <div class="section">
    <div class="section-title">PROCEDIMIENTOS REALIZADOS</div>
    <div class="content-box">
      ${evolution.procedimientos}
    </div>
  </div>
  ` : ''}

  ${evolution.plan_tratamiento ? `
  <div class="section">
    <div class="section-title">PLAN DE TRATAMIENTO</div>
    <div class="content-box">
      ${evolution.plan_tratamiento}
    </div>
  </div>
  ` : ''}

  ${evolution.recomendaciones ? `
  <div class="section">
    <div class="section-title">RECOMENDACIONES</div>
    <div class="content-box">
      ${evolution.recomendaciones}
    </div>
  </div>
  ` : ''}

  ${evolution.es_cierre ? `
  <div class="closure-section">
    <div class="closure-title">CIERRE DE TRATAMIENTO</div>
    ${evolution.concepto_profesional ? `
    <div style="margin-bottom: 15px;">
      <div class="info-label">Concepto Profesional</div>
      <div class="info-value">${evolution.concepto_profesional}</div>
    </div>
    ` : ''}
    ${evolution.evaluacion_final ? `
    <div>
      <div class="info-label">Evaluación Final</div>
      <div class="info-value">${evolution.evaluacion_final}</div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="signature-section">
    ${therapist.firma_digital_url ? `<img src="${therapist.firma_digital_url}" class="signature-image" alt="Firma digital" />` : ''}
    <div class="signature-line">
      <strong>${therapist.nombre_completo}</strong><br/>
      ${especialidadLabels[therapist.especialidad] || therapist.especialidad}<br/>
      Cédula: ${therapist.cedula}
    </div>
  </div>

  <div class="footer">
    <p>Documento generado el ${fechaEvolucion}</p>
    <p>Este documento es una evolución clínica oficial y forma parte del historial médico del paciente.</p>
  </div>
</body>
</html>
  `;

  return html;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { evolutionId } = await req.json();

    if (!evolutionId) {
      throw new Error('evolutionId es requerido');
    }

    console.log('Generating PDF for evolution:', evolutionId);

    // Fetch evolution with all related data
    const { data: evolution, error: evolutionError } = await supabase
      .from('evolutions')
      .select(`
        *,
        sessions (
          id,
          numero_sesion,
          fecha_programada,
          hora_inicio,
          ubicacion,
          medical_orders (
            id,
            especialidad,
            diagnostico,
            total_sesiones,
            ubicacion,
            patients (
              id,
              nombre_completo,
              cedula,
              fecha_nacimiento,
              sexo
            )
          )
        ),
        therapist_profiles (
          id,
          nombre_completo,
          cedula,
          especialidad,
          firma_digital_url
        )
      `)
      .eq('id', evolutionId)
      .single();

    if (evolutionError) {
      console.error('Error fetching evolution:', evolutionError);
      throw new Error('No se pudo obtener la evolución');
    }

    if (!evolution) {
      throw new Error('Evolución no encontrada');
    }

    console.log('Evolution data fetched successfully');

    const htmlContent = generatePDFContent({
      evolution,
      session: evolution.sessions,
      patient: evolution.sessions?.medical_orders?.patients,
      therapist: evolution.therapist_profiles,
      order: evolution.sessions?.medical_orders,
    });

    // Return HTML content (client can print to PDF)
    return new Response(htmlContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error generating PDF:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
