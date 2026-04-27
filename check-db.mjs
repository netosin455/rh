import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: 'process.env.DATABASE_URL'
});

const { rows: tables } = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);
console.log('Tabelas:', tables.map(t => t.table_name));

const { rows: cols } = await pool.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
  ORDER BY ordinal_position
`);
console.log('\nColunas de users:', cols.map(c => `${c.column_name}(${c.data_type})`));

await pool.end();
