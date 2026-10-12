import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

function saveLayoutPlugin() {
  return {
    name: 'save-layout-plugin',
    configureServer(server) {
      server.middlewares.use('/api/save-layout', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              JSON.parse(body);
              const filePath = path.resolve(process.cwd(), 'src/game/defaultLayout.json');
              fs.writeFileSync(filePath, body);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), saveLayoutPlugin()],
  server: {
    port: 5173
  }
});
