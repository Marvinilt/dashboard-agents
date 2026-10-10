import { chromium } from 'playwright';

async function testLeftSidebar() {
  console.log('--- Probando Barra Lateral Izquierda Colapsable y Stats del Agente ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);

    // 1. Clic en el canvas sobre el primer avatar para que se expanda automáticamente la barra lateral izquierda
    const canvas = await page.waitForSelector('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      console.log('Haciendo clic sobre avatar en la oficina...');
      await page.mouse.click(box.x + 380, box.y + 170);
      await page.waitForTimeout(1500);

      // Verificar que el panel lateral izquierdo ahora está visible
      const sidebar = await page.waitForSelector('aside', { timeout: 5000 });
      const sidebarBox = await sidebar.boundingBox();
      console.log(`✓ Barra lateral izquierda visible en posición X: ${sidebarBox?.x}, Ancho: ${sidebarBox?.width}px`);

      // 2. Verificar datos en el encabezado: Hora de Inicio y Acciones Ejecutadas
      const startText = await page.locator('text=Inicio').locator('..').textContent();
      const actionsText = await page.locator('text=Acciones').locator('..').textContent();
      console.log(`✓ Métrica de Inicio detectada: "${startText?.replace(/\s+/g, ' ').trim()}"`);
      console.log(`✓ Métrica de Acciones detectada: "${actionsText?.replace(/\s+/g, ' ').trim()}"`);

      // 3. Tomar captura de pantalla de evidencia
      await page.screenshot({ path: 'qa_left_sidebar_evidence.png' });
      console.log('✓ Captura de pantalla guardada en qa_left_sidebar_evidence.png');

      console.log('--- ¡Validación de barra lateral izquierda completada con éxito! ---');
    }
  } catch (err) {
    console.error('Error durante la prueba:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testLeftSidebar();
