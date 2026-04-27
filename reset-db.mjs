import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new Pool({
  connectionString: 'process.env.DATABASE_URL'
});

console.log('Dropando schema existente...');
await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
console.log('Schema limpo.');

const schema = readFileSync(join(__dirname, 'schema', 'schema.sql'), 'utf8');
console.log('Aplicando schema SuperRH...');
await pool.query(schema);
console.log('Schema aplicado!');

await pool.end();
