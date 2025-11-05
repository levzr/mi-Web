import pkg from 'pg';
const { Pool } = pkg;

// Conexión directa sin dotenv
export const pool = new Pool({
  host: 'localhost',        
  user: 'pedidos_user',     //usuario de PostgreSQL
  password: '1234', //contraseña
  database: 'pedidoshn',
  port: 5432
});
