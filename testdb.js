import { pool } from './db.js';

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexión exitosa a PostgreSQL:', result.rows[0]);
  } catch (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err);
  }
}

testConnection();
