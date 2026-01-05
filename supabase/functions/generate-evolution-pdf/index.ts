import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const especialidadLabels: Record<string, string> = {
  fisioterapia: 'Fisioterapia',
  fonoaudiologia: 'Fonoaudiología',
  terapia_ocupacional: 'Terapia Ocupacional',
  psicologia: 'Psicología',
  terapia_acuatica: 'Terapia Acuática',
};

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Generate single evolution PDF
function generateSingleEvolutionHTML(data: {
  evolution: any;
  session: any;
  patient: any;
  therapist: any;
  order: any;
}): string {
  const { evolution, session, patient, therapist, order } = data;
  const age = calculateAge(new Date(patient.fecha_nacimiento));
  const fechaEvolucion = new Date(evolution.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 25px; }
    .section-title { background-color: #f0f9ff; padding: 8px 12px; border-left: 4px solid #2563eb; font-weight: bold; color: #1e40af; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { padding: 5px 0; }
    .info-label { font-weight: bold; color: #666; font-size: 11px; }
    .info-value { color: #333; }
    .content-box { background-color: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 15px; margin-top: 10px; }
    .signature-section { margin-top: 50px; text-align: center; }
    .signature-line { border-top: 1px solid #333; width: 250px; margin: 0 auto; padding-top: 10px; }
    .signature-image { max-height: 60px; margin-bottom: 10px; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    .badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .closure-section { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin-top: 20px; }
    .closure-title { color: #b45309; font-weight: bold; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVOLUCIÓN CLÍNICA</h1>
    <p>Sesión #${session.numero_sesion} ${evolution.es_cierre ? '- CIERRE DE TRATAMIENTO' : ''}</p>
    <p>${formatDate(session.fecha_programada)}</p>
  </div>

  <div class="section">
    <div class="section-title">DATOS DEL PACIENTE</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Nombre Completo</div><div class="info-value">${patient.nombre_completo}</div></div>
      <div class="info-item"><div class="info-label">Identificación</div><div class="info-value">${patient.cedula || 'No registrada'}</div></div>
      <div class="info-item"><div class="info-label">Edad</div><div class="info-value">${age} años</div></div>
      <div class="info-item"><div class="info-label">Fecha de Nacimiento</div><div class="info-value">${new Date(patient.fecha_nacimiento).toLocaleDateString('es-CO')}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">INFORMACIÓN DE LA ORDEN MÉDICA</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Especialidad</div><div class="info-value"><span class="badge">${especialidadLabels[order.especialidad] || order.especialidad}</span></div></div>
      <div class="info-item"><div class="info-label">Sesión</div><div class="info-value">${session.numero_sesion} de ${order.total_sesiones}</div></div>
      <div class="info-item"><div class="info-label">Ubicación</div><div class="info-value">${session.ubicacion === 'intramural' ? 'Intramural' : 'Domiciliaria'}</div></div>
      <div class="info-item"><div class="info-label">Hora</div><div class="info-value">${session.hora_inicio}</div></div>
    </div>
    ${order.diagnostico ? `<div class="content-box"><div class="info-label">Diagnóstico</div><div class="info-value">${order.diagnostico}</div></div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">EVOLUCIÓN DE LA SESIÓN</div>
    <div class="content-box">${evolution.contenido}</div>
  </div>

  ${evolution.procedimientos ? `<div class="section"><div class="section-title">PROCEDIMIENTOS REALIZADOS</div><div class="content-box">${evolution.procedimientos}</div></div>` : ''}
  ${evolution.plan_tratamiento ? `<div class="section"><div class="section-title">PLAN DE TRATAMIENTO</div><div class="content-box">${evolution.plan_tratamiento}</div></div>` : ''}
  ${evolution.recomendaciones ? `<div class="section"><div class="section-title">RECOMENDACIONES</div><div class="content-box">${evolution.recomendaciones}</div></div>` : ''}

  ${evolution.es_cierre ? `
  <div class="closure-section">
    <div class="closure-title">CIERRE DE TRATAMIENTO</div>
    ${evolution.concepto_profesional ? `<div style="margin-bottom: 15px;"><div class="info-label">Concepto Profesional</div><div class="info-value">${evolution.concepto_profesional}</div></div>` : ''}
    ${evolution.evaluacion_final ? `<div><div class="info-label">Evaluación Final</div><div class="info-value">${evolution.evaluacion_final}</div></div>` : ''}
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
}

// Generate complete package PDF with initial evaluation and all evolutions
function generatePackagePDF(data: {
  order: any;
  patient: any;
  therapist: any;
  initialEvaluation: any;
  sessions: any[];
  evolutions: any[];
}): string {
  const { order, patient, therapist, initialEvaluation, sessions, evolutions } = data;
  const age = calculateAge(new Date(patient.fecha_nacimiento));
  const generationDate = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const sortedEvolutions = [...evolutions].sort((a, b) => 
    a.sessions?.numero_sesion - b.sessions?.numero_sesion
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; margin: 0; font-size: 28px; }
    .header h2 { color: #1e40af; margin: 10px 0 5px 0; font-size: 18px; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { background-color: #f0f9ff; padding: 8px 12px; border-left: 4px solid #2563eb; font-weight: bold; color: #1e40af; margin-bottom: 12px; font-size: 14px; }
    .subsection-title { background-color: #e0f2fe; padding: 6px 10px; border-left: 3px solid #0284c7; font-weight: bold; color: #0369a1; margin-bottom: 10px; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { padding: 5px 0; }
    .info-label { font-weight: bold; color: #666; font-size: 11px; }
    .info-value { color: #333; }
    .content-box { background-color: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; padding: 15px; margin-top: 10px; }
    .signature-section { margin-top: 50px; text-align: center; page-break-inside: avoid; }
    .signature-line { border-top: 1px solid #333; width: 250px; margin: 0 auto; padding-top: 10px; }
    .signature-image { max-height: 60px; margin-bottom: 10px; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    .badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .evolution-card { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
    .evolution-header { background-color: #f8fafc; padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .evolution-body { padding: 15px; }
    .closure-section { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 15px; margin-top: 20px; }
    .closure-title { color: #b45309; font-weight: bold; margin-bottom: 10px; }
    .initial-eval { background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .initial-eval-title { color: #059669; font-weight: bold; font-size: 16px; margin-bottom: 15px; }
    .page-break { page-break-before: always; }
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INFORME CLÍNICO COMPLETO</h1>
    <h2>${especialidadLabels[order.especialidad] || order.especialidad}</h2>
    <p>Código de Orden: ${order.codigo_orden || 'N/A'}</p>
    <p>Paquete de ${order.total_sesiones} sesiones</p>
  </div>

  <div class="section">
    <div class="section-title">DATOS DEL PACIENTE</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Nombre Completo</div><div class="info-value">${patient.nombre_completo}</div></div>
      <div class="info-item"><div class="info-label">Identificación</div><div class="info-value">${patient.cedula || 'No registrada'}</div></div>
      <div class="info-item"><div class="info-label">Edad</div><div class="info-value">${age} años</div></div>
      <div class="info-item"><div class="info-label">Fecha de Nacimiento</div><div class="info-value">${new Date(patient.fecha_nacimiento).toLocaleDateString('es-CO')}</div></div>
      <div class="info-item"><div class="info-label">EPS</div><div class="info-value">${patient.eps || 'No registrada'}</div></div>
      <div class="info-item"><div class="info-label">Dirección</div><div class="info-value">${patient.direccion || 'No registrada'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">TERAPEUTA RESPONSABLE</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Nombre</div><div class="info-value">${therapist.nombre_completo}</div></div>
      <div class="info-item"><div class="info-label">Especialidad</div><div class="info-value">${especialidadLabels[therapist.especialidad] || therapist.especialidad}</div></div>
      <div class="info-item"><div class="info-label">Cédula</div><div class="info-value">${therapist.cedula}</div></div>
    </div>
  </div>

  ${order.diagnostico ? `
  <div class="section">
    <div class="section-title">DIAGNÓSTICO MÉDICO</div>
    <div class="content-box">${order.diagnostico}</div>
  </div>
  ` : ''}

  ${initialEvaluation ? `
  <div class="initial-eval">
    <div class="initial-eval-title">EVALUACIÓN INICIAL</div>
    <p style="font-size: 11px; color: #666; margin-bottom: 15px;">Realizada el ${formatDate(initialEvaluation.created_at)}</p>
    
    <div class="section">
      <div class="subsection-title">Diagnóstico CIE-10</div>
      <div class="content-box">
        ${initialEvaluation.codigo_cie10 ? `<strong>Código:</strong> ${initialEvaluation.codigo_cie10}<br/>` : ''}
        ${initialEvaluation.diagnostico_cie10}
      </div>
    </div>

    ${initialEvaluation.funciones_corporales || initialEvaluation.estructuras_corporales || initialEvaluation.actividades_participacion ? `
    <div class="section">
      <div class="subsection-title">Clasificación CIF</div>
      ${initialEvaluation.funciones_corporales ? `<div style="margin-bottom: 10px;"><strong>Funciones Corporales:</strong><br/>${initialEvaluation.funciones_corporales}</div>` : ''}
      ${initialEvaluation.estructuras_corporales ? `<div style="margin-bottom: 10px;"><strong>Estructuras Corporales:</strong><br/>${initialEvaluation.estructuras_corporales}</div>` : ''}
      ${initialEvaluation.actividades_participacion ? `<div style="margin-bottom: 10px;"><strong>Actividades y Participación:</strong><br/>${initialEvaluation.actividades_participacion}</div>` : ''}
      ${initialEvaluation.factores_ambientales ? `<div style="margin-bottom: 10px;"><strong>Factores Ambientales:</strong><br/>${initialEvaluation.factores_ambientales}</div>` : ''}
      ${initialEvaluation.factores_personales ? `<div><strong>Factores Personales:</strong><br/>${initialEvaluation.factores_personales}</div>` : ''}
    </div>
    ` : ''}

    <div class="section">
      <div class="subsection-title">Plan de Tratamiento</div>
      <div style="margin-bottom: 10px;"><strong>Objetivos Generales:</strong><br/>${initialEvaluation.objetivos_generales}</div>
      ${initialEvaluation.objetivos_especificos ? `<div style="margin-bottom: 10px;"><strong>Objetivos Específicos:</strong><br/>${initialEvaluation.objetivos_especificos}</div>` : ''}
      <div style="margin-bottom: 10px;"><strong>Plan de Intervención:</strong><br/>${initialEvaluation.plan_intervencion}</div>
      ${initialEvaluation.frecuencia_sesiones ? `<div><strong>Frecuencia:</strong> ${initialEvaluation.frecuencia_sesiones}</div>` : ''}
      ${initialEvaluation.duracion_estimada ? `<div><strong>Duración Estimada:</strong> ${initialEvaluation.duracion_estimada}</div>` : ''}
    </div>
  </div>
  ` : ''}

  <div class="page-break"></div>

  <div class="section">
    <div class="section-title">EVOLUCIONES CLÍNICAS</div>
    
    ${sortedEvolutions.map((evolution, index) => {
      const session = evolution.sessions;
      return `
      <div class="evolution-card">
        <div class="evolution-header">
          <div>
            <strong>Sesión #${session?.numero_sesion}</strong>
            ${evolution.es_cierre ? '<span class="badge" style="background-color: #fef3c7; color: #b45309; margin-left: 10px;">CIERRE</span>' : ''}
          </div>
          <div style="font-size: 11px; color: #666;">
            ${formatDate(session?.fecha_programada)} - ${session?.hora_inicio}
          </div>
        </div>
        <div class="evolution-body">
          <div style="margin-bottom: 15px;">
            <strong>Evolución:</strong>
            <div class="content-box">${evolution.contenido}</div>
          </div>
          ${evolution.procedimientos ? `<div style="margin-bottom: 15px;"><strong>Procedimientos:</strong><div class="content-box">${evolution.procedimientos}</div></div>` : ''}
          ${evolution.plan_tratamiento ? `<div style="margin-bottom: 15px;"><strong>Plan de Tratamiento:</strong><div class="content-box">${evolution.plan_tratamiento}</div></div>` : ''}
          ${evolution.recomendaciones ? `<div style="margin-bottom: 15px;"><strong>Recomendaciones:</strong><div class="content-box">${evolution.recomendaciones}</div></div>` : ''}
          
          ${evolution.es_cierre ? `
          <div class="closure-section">
            <div class="closure-title">CIERRE DE TRATAMIENTO</div>
            ${evolution.concepto_profesional ? `<div style="margin-bottom: 10px;"><strong>Concepto Profesional:</strong><br/>${evolution.concepto_profesional}</div>` : ''}
            ${evolution.evaluacion_final ? `<div><strong>Evaluación Final:</strong><br/>${evolution.evaluacion_final}</div>` : ''}
          </div>
          ` : ''}
        </div>
      </div>
      `;
    }).join('')}
  </div>

  <div class="signature-section">
    ${therapist.firma_digital_url ? `<img src="${therapist.firma_digital_url}" class="signature-image" alt="Firma digital" />` : ''}
    <div class="signature-line">
      <strong>${therapist.nombre_completo}</strong><br/>
      ${especialidadLabels[therapist.especialidad] || therapist.especialidad}<br/>
      Cédula: ${therapist.cedula}
    </div>
  </div>

  <div class="footer">
    <p>Documento generado el ${generationDate}</p>
    <p>Este documento es un informe clínico oficial y forma parte del historial médico del paciente.</p>
    <p>Total de sesiones: ${order.total_sesiones} | Sesiones documentadas: ${evolutions.length}</p>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { evolutionId, orderId } = await req.json();

    // If orderId is provided, generate complete package PDF
    if (orderId) {
      console.log('Generating complete package PDF for order:', orderId);

      // Fetch order with patient and therapist
      const { data: order, error: orderError } = await supabase
        .from('medical_orders')
        .select(`
          *,
          patients (*),
          therapist_profiles (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw new Error('No se pudo obtener la orden médica');

      // Fetch initial evaluation
      const { data: initialEvaluation } = await supabase
        .from('initial_evaluations')
        .select('*')
        .eq('medical_order_id', orderId)
        .maybeSingle();

      // Fetch all sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('medical_order_id', orderId)
        .order('numero_sesion', { ascending: true });

      // Fetch all evolutions for this order
      const { data: evolutions } = await supabase
        .from('evolutions')
        .select(`
          *,
          sessions (*)
        `)
        .in('session_id', sessions?.map(s => s.id) || []);

      const htmlContent = generatePackagePDF({
        order,
        patient: order.patients,
        therapist: order.therapist_profiles,
        initialEvaluation,
        sessions: sessions || [],
        evolutions: evolutions || [],
      });

      return new Response(htmlContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // If evolutionId is provided, generate single evolution PDF
    if (evolutionId) {
      console.log('Generating PDF for evolution:', evolutionId);

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

      if (evolutionError) throw new Error('No se pudo obtener la evolución');

      const htmlContent = generateSingleEvolutionHTML({
        evolution,
        session: evolution.sessions,
        patient: evolution.sessions?.medical_orders?.patients,
        therapist: evolution.therapist_profiles,
        order: evolution.sessions?.medical_orders,
      });

      return new Response(htmlContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    throw new Error('Se requiere evolutionId o orderId');

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
