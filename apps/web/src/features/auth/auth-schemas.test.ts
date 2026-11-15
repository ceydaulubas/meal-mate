import { signInSchema, signUpSchema } from '@meal-mate/contracts';
import { describe, expect, it } from 'vitest';

describe('authentication schemas', () => {
  it('rejects empty display names, invalid emails, and short passwords', () => {
    const result = signUpSchema.safeParse({
      displayName: '   ',
      email: 'not-an-email',
      password: 'short',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const fields = result.error.issues.map((issue) => issue.path[0]);

    expect(fields).toEqual(expect.arrayContaining(['displayName', 'email', 'password']));
  });

  it('trims valid sign-up values', () => {
    const result = signUpSchema.parse({
      displayName: '  Alice  ',
      email: ' alice@example.com ',
      password: 'supersecret',
    });

    expect(result).toEqual({
      displayName: 'Alice',
      email: 'alice@example.com',
      password: 'supersecret',
    });
  });

  it('requires an email and password to sign in', () => {
    const result = signInSchema.safeParse({ email: '', password: '' });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const messages = result.error.issues.map((issue) => issue.message);

    expect(messages).toContain('Enter a valid email address.');
    expect(messages).toContain('Enter your password.');
  });
});
