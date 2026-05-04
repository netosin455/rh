import { Pool, neonConfig } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Erro: variável DATABASE_URL não definida. Crie um arquivo .env.local e defina DATABASE_URL.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const passwordHash = await bcrypt.hash('admin123', 10);

try {
  // Empresa
  const { rows: [company] } = await pool.query(`
    INSERT INTO companies (name, cnpj, plan)
    VALUES ('Ferreira & Associados', '00.000.000/0001-00', 'pro')
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  let companyId = company?.id;
  if (!companyId) {
    const { rows: [existing] } = await pool.query(`SELECT id FROM companies LIMIT 1`);
    companyId = existing.id;
    console.log('Empresa já existia, usando id:', companyId);
  } else {
    console.log('Empresa criada, id:', companyId);
  }

  // Admin
  const { rows: [user] } = await pool.query(`
    INSERT INTO users (company_id, name, email, password_hash, role)
    VALUES ($1, 'Admin', 'admin@escritorio.com', $2, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = $2
    RETURNING id, email, role
  `, [companyId, passwordHash]);

  console.log('Usuário admin:', user);
  console.log('\nCredenciais de acesso:');
  console.log('  Email: admin@escritorio.com');
  console.log('  Senha: admin123');
} catch (e) {
  console.error('ERRO:', e.message);
} finally {
  await pool.end();
}
