import fs from 'fs';
import path from 'path';

/**
 * Normaliza y clasifica los eventos de bajo nivel de transcript.jsonl
 * a eventos semánticos para el dashboard y avatares.
 */
export function parseTranscriptLine(lineStr, fallbackAgentId = 'main-orchestrator') {
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

  // Detección de subagente involucrado o emisor
  let agentId = fallbackAgentId;
  let agentRole = 'software_engineer';
  let eventType = 'AGENT_UPDATE';
  let state = 'WORKING'; // SPAWNING, WORKING, THINKING, WAITING_INPUT, IDLE, DESPAWNING, ERROR
  let toolInUse = null;
  let toolArgs = null;
  let detailMessage = '';
  let invokedSubagent = null;

  // 1. Mensaje de Sistema o Notificaciones internas
  if (type === 'SYSTEM_MESSAGE') {
    state = 'WORKING';
    detailMessage = 'Mensaje del sistema recibido';
    if (typeof raw.content === 'string') {
      const matchSender = raw.content.match(/sender=([a-zA-Z0-9_-]+)/);
      if (matchSender) {
        agentId = matchSender[1];
      }
      if (raw.content.includes('Hola Documentador') || raw.content.toLowerCase().includes('documentador')) {
        agentRole = 'documenter';
      } else if (raw.content.toLowerCase().includes('qa') || raw.content.toLowerCase().includes('tester')) {
        agentRole = 'qa_tester';
      } else if (raw.content.toLowerCase().includes('dba') || raw.content.toLowerCase().includes('database')) {
        agentRole = 'dba_architect';
      }
    }
  }

  // 2. Respuesta del Modelo / Planner
  if (type === 'PLANNER_RESPONSE') {
    if (raw.thinking) {
      state = 'THINKING';
      detailMessage = raw.thinking.slice(0, 150) + (raw.thinking.length > 150 ? '...' : '');
    }

    if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
      state = 'WORKING';
      const firstTool = raw.tool_calls[0];
      toolInUse = firstTool.name;
      toolArgs = firstTool.args;
      detailMessage = `Ejecutando herramienta: ${toolInUse}`;

      // Detectar si invocó a un subagente
      if (firstTool.name === 'invoke_subagent') {
        eventType = 'AGENT_SPAWNED';
        state = 'SPAWNING';
        const subagents = firstTool.args?.Subagents;
        if (Array.isArray(subagents) && subagents.length > 0) {
          invokedSubagent = {
            role: subagents[0].Role || 'Subagent',
            type: subagents[0].TypeName || 'assistant'
          };
          detailMessage = `Invocando subagente: ${invokedSubagent.role}`;
        }
      } else if (firstTool.name === 'write_to_file' || firstTool.name === 'replace_file_content') {
        agentRole = 'software_engineer';
        detailMessage = `Escribiendo código: ${firstTool.args?.TargetFile ? path.basename(firstTool.args.TargetFile) : 'archivo'}`;
      } else if (firstTool.name === 'view_file' || firstTool.name === 'list_dir') {
        detailMessage = `Inspeccionando repositorio: ${firstTool.args?.AbsolutePath || firstTool.args?.DirectoryPath || ''}`;
      } else if (firstTool.name === 'run_command') {
        detailMessage = `Ejecutando comando terminal: ${firstTool.args?.CommandLine || ''}`;
      } else if (firstTool.name === 'ask_question') {
        state = 'WAITING_INPUT';
        eventType = 'AGENT_BLOCKED';
        detailMessage = 'Esperando respuesta o permisos del usuario';
      }
    }
  }

  // 3. Espera de interacción o entrada de usuario
  if (type === 'USER_INPUT' || status === 'WAITING_FOR_INPUT') {
    state = 'WAITING_INPUT';
    eventType = 'AGENT_BLOCKED';
    detailMessage = 'Esperando input del usuario...';
  }

  // 4. Errores
  if (status === 'ERROR' || status === 'CANCELLED') {
    state = 'ERROR';
    detailMessage = 'Error en ejecución de tarea';
  }

  return {
    eventId: `evt_${stepIndex}_${Date.now()}`,
    stepIndex,
    timestamp,
    agentId,
    agentRole,
    state,
    eventType,
    rawType: type,
    rawStatus: status,
    source,
    metadata: {
      toolInUse,
      toolArgs,
      detailMessage,
      invokedSubagent,
      rawContentSnippet: raw.content ? String(raw.content).slice(0, 200) : null
    }
  };
}

