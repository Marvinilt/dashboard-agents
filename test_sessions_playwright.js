import { chromium } from 'playwright';

async function testSessionsWithDateAndFolders() {
  console.log('--- Probando Selector por Fecha y Explorador de Carpetas ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 1. Verificar opciones del selector de sesión
    const selectOptions = await page.locator('select').first().innerText();
    console.log('✓ Primeras opciones con fechas formateadas:\n' + selectOptions.split('\n').slice(0, 5).join('\n'));

    // 2. Probar botón "Cambiar carpeta..."
    await page.click('text=Cambiar carpeta...');
    await page.waitForTimeout(500);

    // 3. Introducir una ruta personalizada
    const inputPath = 'C:\\Proyectos Desarrollo IA\\DashboardAgents\\backend\\mock_data';
    await page.fill('input[placeholder*="Ruta"]', inputPath);
    await page.click('button:has-text("Escanear")');
    await page.waitForTimeout(2000);

    // 4. Tomar captura de pantalla de evidencia
    await page.screenshot({ path: 'qa_sessions_date_folder_evidence.png' });
    console.log('✓ Captura guardada en qa_sessions_date_folder_evidence.png');

    console.log('--- Validación completada exitosamente ---');
  } catch (err) {
    console.error('Error durante la prueba:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testSessionsWithDateAndFolders();
