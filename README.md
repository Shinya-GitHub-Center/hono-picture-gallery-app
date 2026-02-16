# [学習用]Picture Gallery App[hono.dev]

- 以前Flask + Pythonで作った簡単な画像投稿サイトをHono + TypeScript + Cloudflare へリファクタリングしたバージョンです。
- 学習用なので個人や友人間でのテスト利用でお願いします

## 機能

- **ユーザー認証**: Better Auth によるメールアドレスでの登録・ログイン
- **画像アップロード**: R2バケットへの画像保存
- **画像一覧表示**: すべてのユーザーの投稿を表示
- **マイページ**: 自分の投稿のみを表示・削除
- **ユーザー別投稿一覧**: 特定ユーザーの投稿を表示
- **詳細表示**: 画像と投稿情報の詳細表示

## 技術スタック

- **フレームワーク**: Hono
- **ランタイム**: Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **ストレージ**: Cloudflare R2
- **認証**: Better Auth（カスタムハッシュ関数使用）
- **ビルドツール**: Vite
- **言語**: TypeScript

## Cloudflare Workers最適化

### パスワードハッシュのカスタマイズ

このアプリケーションでは、Cloudflare Workers環境に最適化されたパスワードハッシュ方式を採用しています。

#### 背景と課題

Better Authのデフォルトパスワードハッシュ実装（`@noble/hashes`）はPure JavaScriptで書かれており、以下の問題がありました：

1. **CPU時間の超過**: Cloudflare Workers無料プランのCPU制限（10ms）を超過
2. **ランダムなエラー**: 認証時に「Worker exceeded CPU time limit」や「The script will never generate a response」エラーが発生
3. **有料プランでも不安定**: 有料プラン（30秒制限）でも、高負荷時に同様のエラーが発生する場合がある

**実測データ（デフォルト実装）:**
- CPU時間: 51ms → 無料プランの10ms制限を大幅超過
- 結果: 503エラー（Service Unavailable）

#### 解決策: Node.js `node:crypto` を使用したカスタムハッシュ

Cloudflareは2024年7月から`node:crypto`の互換レイヤーでネイティブScryptをサポートしています。これを活用することで、CPU時間を大幅に削減できます。

**実装内容（`src/middleware/auth/config.ts`）:**

```typescript
import { randomBytes, scryptSync } from 'node:crypto';

emailAndPassword: {
  enabled: true,
  password: {
    hash: async (password) => {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      return `${salt}:${hash}`;
    },
    verify: async ({ hash, password }) => {
      const [salt, key] = hash.split(':');
      const keyBuffer = Buffer.from(key, 'hex');
      const hashBuffer = scryptSync(password, salt, 64);
      return keyBuffer.equals(hashBuffer);
    },
  },
}
```

**メリット:**
- ✅ **CPU時間の大幅削減**: Pure JS実装からCloudflareネイティブ実装へ
- ✅ **無料プランで安定動作**: CPU制限内に収まる
- ✅ **セキュリティ維持**: scryptは業界標準のパスワードハッシュアルゴリズム
- ✅ **設定不要**: `wrangler.toml`の`nodejs_compat`フラグで有効化済み

**注意点:**
- 新規ユーザーから新しいハッシュ形式が適用されます
- 既存ユーザーは古いハッシュ形式のまま（ログイン時に若干のCPU時間がかかる可能性）

**参考:**
- [Cloudflare Workers node:crypto サポート](https://developers.cloudflare.com/workers/platform/changelog/#2024-07-03)
- [Better Auth Issue #969](https://github.com/better-auth/better-auth/issues/969#issuecomment-2833532886)

## レンダリングの仕組み

このアプリケーションは**SSR (Server-Side Rendering)** と**クライアントサイドJS**を組み合わせています。

### SSR部分
- `c.render()` で記述されたJSX/TSXコード全体がサーバーサイドでHTMLに変換されます（のちにクライアントサイドでハイドレーションさせる部分も単なるテキストの塊として含ませている）
- 初回ページロード時に完全なHTMLがクライアントに送信されます

### クライアントサイドJS部分
- `{html`...`}` タグ内の `<script>` ブロックがブラウザで実行されるJavaScriptです（この部分がクライアントサイドで抽出されハイドレーションされる）
- フォーム送信やイベントハンドリングなどのインタラクティブな機能を提供します
- 例: ログインフォームの送信処理、削除確認ダイアログなど

**メリット:**
- SEOに有利で初回表示が高速（SSR）
- ユーザーインタラクションは動的に処理（クライアントサイドJS）
- Cloudflare Workers上で軽量に動作

## プロジェクト構造

```
src/
├── index.tsx              # メインアプリケーション（ルーティング）
├── renderer.tsx           # レイアウトコンポーネント
├── types.ts               # 型定義
├── style.css              # スタイルシート
└── middleware/
    ├── auth/
    │   ├── config.ts      # Better Auth 設定
    │   ├── index.ts       # 認証機能エクスポート
    │   └── middleware.ts  # 認証ミドルウェア
    └── db/
        ├── index.ts       # DBミドルウェア
        ├── schema.ts      # Drizzleスキーマ
        └── migrations/    # マイグレーションファイル
```

## 開発コマンド
```
# .env.exampleを.envにファイル名変更
# BETTER_AUTH_SECRETにシークレットキー（最低32文字）を設定

# wrangler.toml.exampleをwrangler.tomlにファイル名変更

# データベースマイグレーション生成
bun run gen

# ローカルDBにマイグレーション適用
bun run push:local <DB_NAME>

# ローカル開発サーバー起動
bun run dev

# クリーンアップ
bun run clear  # .wrangler/ と dist/ を削除
bun run reset  # node_modules/ も含めて削除
```

※参考： [シークレットキー作成サイト](https://www.better-auth.com/docs/installation#set-environment-variables)

## 本番デプロイ
```
#リモートにデータベースを作成後、IDを`wrangler.toml`にコピペ

#リモートにバケットを作成

# リモートDBにマイグレーション適用
bun run push:remote <DB_NAME>

# デプロイ（ビルド含む）
bun run deploy

# リモートにシークレットを注入
# シークレットは開発環境とは違うものを推奨、URLは本番環境のURLを指定
bun run secret BETTER_AUTH_SECRET
bun run secret BETTER_AUTH_URL
```

## その他
- テスト用アプリなので、メールアドレスの検証はオフ（`requireEmailVerification: false`）にしている。なお、オンにしてのテストランはしていないので各自で試してください。
- `index.tsx`からサインナップを一時中止する処理も実装（友人同士のテストランでお役立てください）
- 現在投稿日時は日本時間で表示されるようになっていますが、GMTにするには`toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })`の第２引数timeZoneオブジェクトリテラルを削除してください。