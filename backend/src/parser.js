import path from 'path';

export const ROLE_DEFINITIONS = {
  team_leader: { role: 'team_leader', id: 'team_leader', name: 'Team Leader' },
  designer: { role: 'designer', id: 'agent_designer', name: 'UI/UX Designer' },
  dba: { role: 'dba', id: 'agent_dba', name: 'Arquitecto DBA' },
  developer: { role: 'developer', id: 'agent_developer', name: 'Senior Developer' },
  qa_tester: { role: 'qa_tester', id: 'agent_qa', name: 'QA SDET' },
  security: { role: 'security', id: 'agent_security', name: 'Auditor Seguridad' },
  documenter: { role: 'documenter', id: 'agent_documenter', name: 'Documentador Técnico' }
};

export function mapSubagentRole(typeName = '', roleStr = '') {
  const text = `${typeName} ${roleStr}`.toLowerCase();
  if (text.includes('disen') || text.includes('design') || text.match(/\b(ux|ui)\b/)) {
    return ROLE_DEFINITIONS.designer;
  }
  if (text.match(/\bdba\b/) || text.match(/\bdatabase\b/) || text.includes('base de datos') || text.match(/\b(sql|postgres|postgresql|mysql)\b/)) {
    return ROLE_DEFINITIONS.dba;
  }
  if (text.includes('desarroll') || text.match(/\b(dev|developer|fullstack|frontend|backend)\b/)) {
    return ROLE_DEFINITIONS.developer;
  }
  if (text.match(/\bqa\b/) || text.includes('sdet') || text.includes('calidad') || text.match(/\btest(er|ing)?\b/)) {
    return ROLE_DEFINITIONS.qa_tester;
  }
  if (text.includes('segur') || text.match(/\b(sec|security|audit|hacker)\b/)) {
    return ROLE_DEFINITIONS.security;
  }
  if (text.includes('documen') || text.includes('escrit') || text.includes('redact') || text.includes('changelog')) {
    return ROLE_DEFINITIONS.documenter;
  }
  return {
    role: 'developer',
    id: `agent_${typeName || 'specialist'}`,
    name: roleStr || 'Especialista'
  };
}

let eventCounter = 0;

/**
 * Normaliza y clasifica los eventos de bajo nivel de transcript.jsonl
 * a eventos semánticos para el dashboard y avatares.
 */
export function parseTranscriptLine(lineStr, options = {}) {
  if (!lineStr || !lineStr.trim()) return null;

  let raw;
  try {
    raw = JSON.parse(lineStr);
  } catch (err) {
    return null;
  }

  const timestamp = raw.created_at || new Date().toISOString();
  const stepIndex = raw.step_index ?? 0;
  const source = raw.source || 'UNKNOWN';
  const type = raw.type || 'UNKNOWN';
  const status = raw.status || 'UNKNOWN';

  // Opciones de sobreescritura de identidad (usadas para subagentes)
  let agentId = options.agentId || 'team_leader';
  let agentRole = options.agentRole || 'team_leader';
  let agentName = options.agentName || 'Team Leader';
  let eventType = 'AGENT_UPDATE';
  let state = 'WORKING'; // SPAWNING, WORKING, THINKING, WAITING_INPUT, IDLE, DESPAWNING, ERROR
  let toolInUse = null;
  let toolArgs = null;
  let detailMessage = '';
  let invokedSubagents = [];

  // 1. Mensaje de Sistema o Notificaciones de Subagentes
  if (type === 'SYSTEM_MESSAGE') {
    state = 'WORKING';
    detailMessage = 'Mensaje del sistema recibido';

    if (typeof raw.content === 'string') {
      const content = raw.content;

      // Extraer el remitente del mensaje si existe en el formato Antigravity: sender=...
      const senderMatch = content.match(/sender=([^\s]+)/i);
      const sender = senderMatch ? senderMatch[1] : null;

      // Si este archivo pertenece a un subagente dedicado, mantener su identidad original
      if (options.agentId && options.agentId !== 'team_leader') {
        agentId = options.agentId;
        agentRole = options.agentRole || agentRole;
        agentName = options.agentName || agentName;
        detailMessage = 'Notificación de sistema para agente';
      } else if (sender && sender.includes('/task-')) {
        // Tarea o comando en segundo plano ejecutado por el Team Leader (ej: run_command, scripts, etc.)
        agentId = 'team_leader';
        agentRole = 'team_leader';
        agentName = 'Team Leader';

        const taskMatch = content.match(/Task id\s*"([^"]+)"\s*(finished with result|was canceled|failed)/i);
        if (taskMatch) {
          const taskName = taskMatch[1].split('/').pop();
          const action = taskMatch[2].toLowerCase().includes('cancel')
            ? 'cancelada'
            : (taskMatch[2].toLowerCase().includes('fail') ? 'falló' : 'completada');
          detailMessage = `Tarea en segundo plano (${taskName}) ${action}`;
        } else {
          detailMessage = 'Comando o tarea en segundo plano finalizada';
        }
      } else if (sender && options.subagentsByUuid && options.subagentsByUuid.has(sender)) {
        // Mensaje enviado formalmente por un subagente conocido hacia el Team Leader
        const subInfo = options.subagentsByUuid.get(sender);
        agentId = subInfo.agentId;
        agentRole = subInfo.agentRole;
        agentName = subInfo.agentName;

        const contentIdx = content.indexOf('content=');
        let realMsg = contentIdx !== -1 ? content.slice(contentIdx + 8) : content;
        realMsg = realMsg.replace(/<\/SYSTEM_MESSAGE>[\s\S]*$/i, '').trim();
        const firstLine = realMsg.split('\n')[0].trim().slice(0, 500);
        detailMessage = `${subInfo.agentName}: ${firstLine || 'Reporte de subagente'}`;
      } else if (sender && sender !== 'system' && !sender.includes('/task-')) {
        // Remitente UUID no registrado previamente pero explícito (ej. sesiones de prueba o demo legacy)
        const lower = content.toLowerCase();
        if (lower.includes('dba_report.md') || lower.includes('dba_report')) {
          agentRole = 'dba';
          agentId = 'agent_dba';
          agentName = 'Arquitecto DBA';
          detailMessage = 'Arquitecto DBA entregó reporte de base de datos';
        } else if (lower.includes('design_report.md') || lower.includes('design_report')) {
          agentRole = 'designer';
          agentId = 'agent_designer';
          agentName = 'UI/UX Designer';
          detailMessage = 'UI/UX Designer entregó propuesta visual y especificaciones';
        } else if (lower.includes('qa_report.md') || lower.includes('qa_report')) {
          agentRole = 'qa_tester';
          agentId = 'agent_qa';
          agentName = 'QA SDET';
          detailMessage = 'QA reportó resultados de pruebas y cobertura de calidad';
        } else if (lower.includes('security_audit.md') || lower.includes('security_audit')) {
          agentRole = 'security';
          agentId = 'agent_security';
          agentName = 'Auditor Seguridad';
          detailMessage = 'Auditor de Seguridad finalizó revisión de vulnerabilidades';
        } else if (lower.includes('dev_report.md') || lower.includes('dev_report')) {
          agentRole = 'developer';
          agentId = 'agent_developer';
          agentName = 'Senior Developer';
          detailMessage = 'Desarrollador finalizó implementación de componentes y lógica';
        } else {
          agentId = 'team_leader';
          agentRole = 'team_leader';
          agentName = 'Team Leader';
          detailMessage = 'Mensaje de coordinación del sistema';
        }
      } else {
        // Cualquier otro mensaje del sistema general pertenece al Team Leader
        agentId = 'team_leader';
        agentRole = 'team_leader';
        agentName = 'Team Leader';
        detailMessage = 'Mensaje del sistema';
      }
    }
  }

  // 2. Respuesta del Modelo / Planner (Orquestador principal)
  if (type === 'PLANNER_RESPONSE') {
    if (raw.thinking) {
      state = 'THINKING';
      detailMessage = raw.thinking.slice(0, 500) + (raw.thinking.length > 500 ? '...' : '');
    }

    if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      state = 'WORKING';
      const firstTool = raw.tool_calls[0];
      toolInUse = firstTool.name;
      toolArgs = firstTool.args;
      detailMessage = `Ejecutando herramienta: ${toolInUse}`;

      // Detectar si invocó a uno o más subagentes
      const invokeTool = raw.tool_calls.find(t => t.name === 'invoke_subagent');
      if (invokeTool) {
        eventType = 'AGENT_SPAWNED';
        state = 'SPAWNING';

        let rawSubs = invokeTool.args?.Subagents;
        if (typeof rawSubs === 'string') {
          try {
            rawSubs = JSON.parse(rawSubs);
          } catch (e) {
            rawSubs = [];
          }
        }

        if (Array.isArray(rawSubs) && rawSubs.length > 0) {
          invokedSubagents = rawSubs.map(s => {
            const mapped = mapSubagentRole(s.TypeName, s.Role);
            return {
              id: mapped.id,
              role: mapped.role,
              name: mapped.name,
              typeName: s.TypeName,
              rolePrompt: s.Prompt ? String(s.Prompt).slice(0, 200) : ''
            };
          });

          const names = invokedSubagents.map(s => s.name).join(' y ');
          detailMessage = `Orquestador activó subagente(s): ${names}`;
        }
      } else if (firstTool.name === 'send_message') {
        detailMessage = `Enviando comunicación formal a equipo: ${firstTool.args?.toolSummary || 'Mensaje de coordinación'}`;
      } else if (firstTool.name === 'write_to_file' || firstTool.name === 'replace_file_content') {
        detailMessage = `Modificando archivo: ${firstTool.args?.TargetFile ? path.basename(firstTool.args.TargetFile) : 'código'}`;
      } else if (firstTool.name === 'view_file' || firstTool.name === 'list_dir') {
        detailMessage = `Inspeccionando repositorio: ${firstTool.args?.AbsolutePath || firstTool.args?.DirectoryPath || ''}`;
      } else if (firstTool.name === 'run_command') {
        detailMessage = `Ejecutando comando terminal: ${firstTool.args?.CommandLine || ''}`;
      } else if (firstTool.name === 'ask_question') {
        state = 'WAITING_INPUT';
        eventType = 'AGENT_BLOCKED';
        detailMessage = 'Esperando respuesta o aprobación del usuario';
      }
    }
  }

  // 2.5 Evento GENERIC para capturar la respuesta de invoke_subagent
  if (type === 'GENERIC' && typeof raw.content === 'string' && raw.content.includes('Created the following subagents:')) {
    eventType = 'SUBAGENT_CREATED';
    state = 'SPAWNING';
    try {
      const matches = raw.content.match(/\{\s*"conversationId"[\s\S]*?\}/g);
      if (matches) { const createdSubagents = matches.map(m => JSON.parse(m)); detailMessage = `Subagentes instanciados: ${createdSubagents.length}`; toolArgs = { createdSubagents }; }
    } catch (e) {
      console.error("[Parser] Error parsing subagent creation JSON:", e);
    }
  }

  // 3. Espera de interacción o entrada de usuario
  if (type === 'USER_INPUT' || status === 'WAITING_FOR_INPUT') {
    state = 'WAITING_INPUT';
    eventType = 'AGENT_BLOCKED';
    detailMessage = 'Esperando directrices del usuario...';
  }

  // 4. Errores
  if (status === 'ERROR' || status === 'CANCELLED') {
    state = 'ERROR';
    detailMessage = 'Incidencia en ejecución de tarea';
  }

  // 5. Limpieza de ruido en mensajes
  if (detailMessage) {
    detailMessage = detailMessage.replace(/Created At:.*?\n/g, '').replace(/Completed At:.*?\n/g, '').trim();
  }
  let cleanSnippet = raw.content ? String(raw.content) : null;
  if (cleanSnippet) {
    cleanSnippet = cleanSnippet.replace(/Created At:.*?\n/g, '').replace(/Completed At:.*?\n/g, '').trim();
    cleanSnippet = cleanSnippet.slice(0, 500); // ampliar hasta 500 caracteres
  }

  return {
    eventId: `evt_${agentId}_${stepIndex}_${Date.now()}_${++eventCounter}`,
    stepIndex,
    timestamp,
    agentId,
    agentRole,
    agentName,
    state,
    eventType,
    rawType: type,
    rawStatus: status,
    source,
    metadata: {
      toolInUse,
      toolArgs,
      detailMessage,
      invokedSubagents,
      rawContentSnippet: cleanSnippet
    }
  };
}





