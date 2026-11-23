import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName?: string,
  phone?: string,
  role: string = 'user'
) {
  try {
    // Use upsert to handle concurrent inserts of the same user ID safely
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        phone: phone || '',
        role,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(fullName ? { fullName } : {}),
          ...(phone ? { phone } : {}),
        },
      })
      .returning();

    return result?.[0] || { uid, email, fullName: fullName || email.split('@')[0], phone: phone || '', role };
  } catch (err) {
    console.warn('[AI Studio] Notice: Cloud SQL user sync fallback active:', err);
    return { uid, email, fullName: fullName || email.split('@')[0], phone: phone || '', role };
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    // Sanitize error to avoid leaking internal connection or schema details
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
