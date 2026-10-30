/**
 * Pool de conexões PostgreSQL compartilhado por toda a API.
 */
import pg from 'pg';
import 'dotenv/config';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// INTERVAL do Postgres chega como objeto; devolvemos como texto "HH:MM:SS"
pg.types.setTypeParser(1186, (v) => v);
