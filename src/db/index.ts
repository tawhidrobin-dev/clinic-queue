import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ============================================================
// DATABASE CLIENT SINGLETON
// ============================================================
// Uses postgres.js with { prepare: false } which is REQUIRED
// when using Supabase's Transaction Mode pooler (port 6543).
// Transaction mode does not support prepared statements because
// connections are recycled per transaction.
// ============================================================

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Prevent multiple connections in development (Next.js HMR)
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    prepare: false, // Required for Supabase Transaction Mode pooler
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
