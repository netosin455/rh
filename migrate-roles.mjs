import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: 'process.env.DATABASE_URL'
});

try {
  // Remove o CHECK antigo e adiciona o novo com os 9 papéis
  await pool.query(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check,
      ADD CONSTRAINT users_role_check
        CHECK (role IN ('super_admin','admin','rh','gestor','colaborador','financeiro','juridico','ti','adm'))
  `);
  console.log('✓ Constraint de roles atualizada com sucesso.');
  console.log('  Novos papéis disponíveis: financeiro, juridico, ti, adm');
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await pool.end();
}
