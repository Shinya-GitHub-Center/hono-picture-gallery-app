import { Context, Next } from 'hono';
import { Env, Variables } from '../../types';
import { createAuth } from './config';

/**
 * セッション情報をコンテキストに設定するミドルウェア
 */
export async function sessionMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const auth = createAuth(c.env);

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session) {
      c.set('user', session.user as any);
      c.set('session', session.session as any);
    } else {
      c.set('user', null);
      c.set('session', null);
    }
  } catch (error) {
    console.error('Session middleware error:', error);
    c.set('user', null);
    c.set('session', null);
  }

  await next();
}

/**
 * ログインが必要なルートを保護するミドルウェア
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const user = c.get('user');

  if (!user) {
    return c.redirect('/login');
  }

  await next();
}
