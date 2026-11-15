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

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required.')
  .max(80, 'Display name must be 80 characters or fewer.');

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

export const signUpPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.');

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: signUpPasswordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const profileSchema = z.object({
  id: uuidSchema,
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});

export const spaceTypeSchema = z.enum(['PERSONAL', 'SHARED']);
export const spaceMemberRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER']);

export const spaceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: spaceTypeSchema,
  created_by: uuidSchema,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});

export const spaceMemberSchema = z.object({
  id: uuidSchema,
  space_id: uuidSchema,
  user_id: uuidSchema,
  role: spaceMemberRoleSchema,
  joined_at: isoDateTimeSchema,
});

export type Uuid = z.infer<typeof uuidSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type SpaceType = z.infer<typeof spaceTypeSchema>;
export type SpaceMemberRole = z.infer<typeof spaceMemberRoleSchema>;
export type Space = z.infer<typeof spaceSchema>;
export type SpaceMember = z.infer<typeof spaceMemberSchema>;
