import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = 'process.env.DATABASE_URL';

const pool = new Pool({ connectionString: DATABASE_URL });

const schema = readFileSync(join(__dirname, 'schema', 'schema.sql'), 'utf8');

console.log('Aplicando schema...');

try {
  await pool.query(schema);
  console.log('Schema aplicado com sucesso!');
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await pool.end();
}
