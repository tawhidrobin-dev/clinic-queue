import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',

  // Source of truth: your TypeScript schema barrel export
  schema: './src/db/schema/index.ts',

  // Where drizzle-kit writes generated SQL migration files
  out: './supabase/migrations',

  dbCredentials: {
    // Use the DIRECT connection (port 5432) for migrations.
    // Never use the Transaction Mode pooler (port 6543) for drizzle-kit
    // because prepared statements are required during schema introspection.
    url: process.env.DATABASE_URL_DIRECT!,
  },

  // Log every SQL statement drizzle-kit generates
  verbose: true,

  // Prompt before applying destructive changes (DROP TABLE, DROP COLUMN, etc.)
  strict: true,
});
