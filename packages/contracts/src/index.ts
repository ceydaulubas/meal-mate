import { z } from 'zod';

/** A UUID as returned by Supabase/Postgres. */
export const uuidSchema = z.uuid();

/** An ISO-8601 timestamp with an explicit offset or `Z` suffix. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Shared pagination inputs for future list endpoints. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Uuid = z.infer<typeof uuidSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
