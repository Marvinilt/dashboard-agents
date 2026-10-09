import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { parseTranscriptLine } from './parser.js';

const sampleFile = path.resolve('mock_data/1185b6d1-0f4a-413b-80e1-5f433a17deea/.system_generated/logs/transcript.jsonl');

console.log('--- Probando Parser de Telemetría sobre Transcript Real ---');
console.log('Archivo de prueba:', sampleFile);

if (!fs.existsSync(sampleFile)) {
  console.error('El archivo de prueba no existe:', sampleFile);
  process.exit(1);
}

const fileStream = fs.createReadStream(sampleFile);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let lineCount = 0;
let parsedCount = 0;
const detectedStates = new Set();
const detectedRoles = new Set();

rl.on('line', (line) => {
  lineCount++;
  const event = parseTranscriptLine(line, 'agent-session-1185');
  if (event) {
    parsedCount++;
    detectedStates.add(event.state);
    detectedRoles.add(event.agentRole);
    if (parsedCount <= 10) {
      console.log(`[Paso #${event.stepIndex}] Estado: ${event.state.padEnd(12)} | Rol: ${event.agentRole.padEnd(15)} | Detalle: ${event.metadata.detailMessage}`);
    }
  }
});

rl.on('close', () => {
  console.log('\n--- Resumen de la Prueba del Parser ---');
  console.log(`Líneas procesadas: ${lineCount}`);
  console.log(`Eventos parseados: ${parsedCount}`);
  console.log('Estados detectados:', Array.from(detectedStates));
  console.log('Roles detectados:', Array.from(detectedRoles));
  console.log('¡Prueba superada con éxito!');
});
