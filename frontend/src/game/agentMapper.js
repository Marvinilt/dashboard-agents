export const KEYWORD_MAPPINGS = [
  {
    roleKey: 'team_leader',
    keywords: ['jefe', 'líder', 'lider', 'coordinador', 'orquestador', 'manager', 'director', 'team leader', 'lead', 'orchestrator', 'team_leader']
  },
  {
    roleKey: 'dba',
    keywords: ['dba', 'base de datos', 'database', 'sql', 'almacenamiento', 'datos', 'data']
  },
  {
    roleKey: 'developer',
    keywords: ['dev', 'developer', 'desarrollador', 'programador', 'ingeniero', 'coder', 'backend', 'frontend']
  },
  {
    roleKey: 'designer',
    keywords: ['designer', 'diseñador', 'disenador', 'ui', 'ux', 'arte', 'gráfico', 'grafico', 'interfaz']
  },
  {
    roleKey: 'security',
    keywords: ['security', 'seguridad', 'hacker', 'ciber', 'pentester', 'auditor']
  },
  {
    roleKey: 'qa_tester',
    keywords: ['qa', 'tester', 'pruebas', 'calidad', 'testing', 'evaluador', 'qa_tester']
  },
  {
    roleKey: 'documenter',
    keywords: ['documentador', 'documenter', 'document', 'doc', 'docs', 'escritor', 'técnico', 'tecnico', 'writer', 'redactor', 'documentacion', 'documentación', 'documentation']
  }
];

/**
 * Recibe un rol raw desde los logs de telemetría y devuelve una clave estandarizada 
 * (roleKey) que el Avatar y la UI pueden entender para cargar los Sprites adecuados.
 */
export function mapRawRoleToKey(rawRole) {
  if (!rawRole) return 'developer'; // Fallback por defecto si no viene rol
  const normalized = String(rawRole).toLowerCase().trim();

  // 1. Verificación directa si coincide con la clave exacta o con prefijo "agent_"
  for (const mapping of KEYWORD_MAPPINGS) {
    if (normalized === mapping.roleKey || normalized === `agent_${mapping.roleKey}`) {
      return mapping.roleKey;
    }
  }

  // 2. Verificación por palabras clave contenidas
  for (const mapping of KEYWORD_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (normalized.includes(keyword)) {
        return mapping.roleKey;
      }
    }
  }

  // Si no hay ninguna coincidencia con nuestras palabras clave,
  // asignamos un rol base como desarrollador (o uno que tenga sprite cargado)
  return 'developer';
}

