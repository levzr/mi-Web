import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  host: 'localhost',
  user: 'pedidos_user',
  password: '1234',
  database: 'pedidoshn',
  port: 5432
});

