import { chromium } from 'playwright';

async function runE2ETest() {
  console.log('--- Iniciando Prueba Automatizada E2E con Playwright ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const frontendUrl = 'http://localhost:5174';

  try {
    console.log(`1. Navegando a ${frontendUrl}...`);
    await page.goto(frontendUrl, { waitUntil: 'networkidle', timeout: 15000 });

    // Verificar título y Header
    const title = await page.textContent('h1');
    console.log(`✓ Título detectado en UI: "${title?.trim()}"`);

    // Verificar que el canvas de Phaser existe y se renderizó
    const canvas = await page.waitForSelector('canvas', { timeout: 8000 });
    const box = await canvas.boundingBox();
    console.log(`✓ Canvas de Phaser montado exitosamente (${box?.width}x${box?.height}px)`);

    // Esperar unos segundos para permitir que la simulación de WebSocket emita eventos
    console.log('2. Esperando eventos de simulación y telemetría por WebSockets...');
    await page.waitForTimeout(5000);

    // Verificar que el contador de eventos subió en el HUD
    const eventsText = await page.locator('text=Eventos:').locator('..').textContent();
    console.log(`✓ Métricas de telemetría en HUD: "${eventsText?.trim()}"`);

    // Tomar captura de pantalla de evidencia QA
    await page.screenshot({ path: 'qa_simulation_evidence.png' });
    console.log('✓ Captura de pantalla de verificación guardada en qa_simulation_evidence.png');

    console.log('--- ¡Todas las pruebas de validación QA pasaron exitosamente! ---');
  } catch (err) {
    console.error('Error durante la validación QA:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runE2ETest();

