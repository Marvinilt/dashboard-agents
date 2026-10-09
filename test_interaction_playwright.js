import { chromium } from 'playwright';

async function testClickAndInteraction() {
  console.log('--- Probando Interacción de Clic y Panel Lateral ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);

    // Obtener la posición del canvas y hacer clic en el escritorio del avatar
    const canvas = await page.waitForSelector('canvas');
    const box = await canvas.boundingBox();

    if (box) {
      // Clic aproximado sobre uno de los avatares sentados
      await page.mouse.click(box.x + 380, box.y + 170);
      await page.waitForTimeout(1000);

      // Tomar captura con avatar interactuado
      await page.screenshot({ path: 'qa_agent_interaction.png' });
      console.log('✓ Captura de interacción guardada en qa_agent_interaction.png');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

testClickAndInteraction();
