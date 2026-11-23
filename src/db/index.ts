import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

let dbInstance: any;

try {
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
    if (!global._postgresPool) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 5000,
      });

      global._postgresPool.on('error', (err) => {
        console.warn('Unexpected error on idle SQL pool client:', err);
      });
    }
    dbInstance = drizzle(global._postgresPool, { schema });
  } else {
    throw new Error('Database credentials not set');
  }
} catch {
  console.warn('[AI Studio] Cloud SQL not connected — using mock fallback');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  const queryProxy = new Proxy({}, {
    get: () => noOp,
  });

  const chainable: any = () => chainable;
  chainable.values = () => chainable;
  chainable.onConflictDoUpdate = () => chainable;
  chainable.returning = async () => [];
  chainable.from = () => chainable;
  chainable.where = () => chainable;

  dbInstance = new Proxy({ query: queryProxy }, {
    get: (_, prop) => {
      if (prop === 'query') return queryProxy;
      if (prop === 'insert' || prop === 'select' || prop === 'update' || prop === 'delete') {
        return () => chainable;
      }
      return async () => [];
    },
  });
}

export const db = dbInstance;

