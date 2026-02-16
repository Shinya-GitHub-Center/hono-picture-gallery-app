import { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './middleware/db/schema';

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

export type Variables = {
  db: DrizzleD1Database<typeof schema>;
  user: typeof schema.user.$inferSelect | null;
  session: typeof schema.session.$inferSelect | null;
};
