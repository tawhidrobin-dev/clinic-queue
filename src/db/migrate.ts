/**
 * Programmatic migration runner.
 * Use this for production deployments (e.g., in a build step or startup hook).
 *
 * Usage:
 *   npx tsx src/db/migrate.ts
 *   or via package.json:  npm run db:migrate:run
 *
 * NOTE: Always uses DATABASE_URL_DIRECT (port 5432 direct connection).
 * Never run migrations through the Transaction Mode pooler (port 6543).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL_DIRECT;

  if (!connectionString) {
    throw new Error('DATABASE_URL_DIRECT environment variable is not set');
  }

  // max: 1 — single connection, closes cleanly after migrations complete
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('⏳  Running database migrations...');

  await migrate(db, {
    migrationsFolder: './supabase/migrations',
  });

  console.log('✅  Migrations applied successfully!');

  await client.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
