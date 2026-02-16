import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { randomBytes, scryptSync } from 'node:crypto';
import * as schema from '../db/schema';
import type { Env } from '../../types';

export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // 簡易版なので検証なし
      password: {
        // Cloudflare Workers最適化: node:cryptoのscryptを使用
        hash: async (password) => {
          // ランダムなソルト（16バイト）を生成
          const salt = randomBytes(16).toString('hex');
          // Node.jsのscryptを使ってハッシュ化（Cloudflareネイティブ実装）
          const hash = scryptSync(password, salt, 64).toString('hex');
          // "ソルト:ハッシュ"形式で保存
          return `${salt}:${hash}`;
        },
        verify: async ({ hash, password }) => {
          // 保存されたハッシュからソルトとキーを分離
          const [salt, key] = hash.split(':');
          const keyBuffer = Buffer.from(key, 'hex');
          // 入力されたパスワードを同じソルトでハッシュ化
          const hashBuffer = scryptSync(password, salt, 64);
          // 一致するか確認
          return keyBuffer.equals(hashBuffer);
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7日間
      updateAge: 60 * 60 * 24, // 24時間ごとに更新
    },
    advanced: {
      database: {
        generateId: (options) => {
          // userテーブルのみデータベースに自動生成させる
          if (options.model === 'user') {
            return false; // データベースが自動生成（integer auto increment）
          }
          // account, session, verificationはUUIDを生成
          return crypto.randomUUID();
        },
      },
      // Cloudflare Workers環境でのクライアントIP取得設定
      ipAddress: {
        // Cloudflare独自ヘッダー（CF-Connecting-IP）を優先
        // 優先順位: CF-Connecting-IP > X-Real-IP > X-Forwarded-For
        // IPアドレスを記録したくない場合はdisableIpTrackingをTrueにする
        ipAddressHeaders: ['CF-Connecting-IP', 'X-Real-IP', 'X-Forwarded-For'],
        disableIpTracking: false,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
}

// 型推論用のエクスポート
export type Auth = ReturnType<typeof createAuth>;
