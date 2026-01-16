import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config(); // Esto lee el archivo .env que tienes en la raíz

const pool = new Pool({
  user: process.env.DB_USER || 'alexa_user', // Si falla el .env, usará este por defecto
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'alexa_cory_db',
  password: process.env.DB_PASSWORD || 'Device1.',
  port: process.env.DB_PORT || 5432,
});

export default pool;