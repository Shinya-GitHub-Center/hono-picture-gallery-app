import { Hono } from 'hono';
import { html } from 'hono/html';
import { renderer } from './renderer';
import { dbMiddleware } from './middleware/db';
import { sessionMiddleware, requireAuth, createAuth } from './middleware/auth';
import { picture } from './middleware/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Env, Variables } from './types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ミドルウェアの設定
// useはすべてのリクエストに適用（SvelteKitのhooks.server.tsに近い）
app.use('*', dbMiddleware);
app.use('*', sessionMiddleware);
app.use(renderer);

// Better Auth APIエンドポイント（特定のパスパターンにのみ適用）
app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  // サインアップ一時停止（有効にする場合は下記3行のコメントアウトを解除）
  // if (c.req.path === '/api/auth/sign-up/email') {
  //   return c.json({ message: '現在サインナップを一時的に中止しております' }, 503);
  // }
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// トップページ（未ログイン時のヒーロー画面）
app.get('/welcome', async (c) => {
  return c.render(
    <div class="hero-container">
      <div class="hero-content">
        <h1>Picture Gallery</h1>
        <p class="hero-description">
          あなたの写真を共有しましょう。
          <br />
          美しい瞬間を世界に届けてください。
        </p>
        <div class="hero-buttons">
          <a href="/login" class="btn btn-primary">
            ログイン
          </a>
          <a href="/signup" class="btn btn-secondary">
            サインアップ
          </a>
        </div>
      </div>
    </div>,
    { title: 'ようこそ！ - Picture Gallery', showNav: false }
  );
});

// ログインページ
app.get('/login', async (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/');
  }

  return c.render(
    <>
      <div class="main-container">
        <div class="form-container">
          <h1>ログイン</h1>
          <form id="login-form">
            <div class="form-group">
              <label for="email">メールアドレス</label>
              <input
                type="email"
                id="email"
                name="email"
                class="form-input"
                required
                placeholder="example@example.com"
              />
            </div>
            <div class="form-group">
              <label for="password">パスワード</label>
              <input
                type="password"
                id="password"
                name="password"
                class="form-input"
                required
                placeholder="パスワード"
              />
            </div>
            <div class="form-group">
              <button type="submit" class="btn btn-primary">
                ログイン
              </button>
            </div>
            <div class="error-message" id="error-message" style="display: none;"></div>
          </form>
          <div class="form-footer">
            <p>
              アカウントをお持ちでない方は <a href="/signup">サインアップ</a>
            </p>
            <p>
              <a href="/welcome">トップページに戻る</a>
            </p>
          </div>
        </div>
      </div>
      {html`
        <script>
          document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const email = formData.get('email');
            const password = formData.get('password');

            try {
              const response = await fetch('/api/auth/sign-in/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              });

              if (response.ok) {
                window.location.href = '/';
              } else {
                const error = await response.json();
                document.getElementById('error-message').textContent = error.message || '認証に失敗しました';
                document.getElementById('error-message').style.display = 'block';
              }
            } catch (error) {
              document.getElementById('error-message').textContent = 'ログインに失敗しました';
              document.getElementById('error-message').style.display = 'block';
            }
          });
        </script>
      `}
    </>,
    { title: 'ログイン - Picture Gallery', showNav: false }
  );
});

// サインアップページ
app.get('/signup', async (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/');
  }

  return c.render(
    <>
      <div class="main-container">
        <div class="form-container">
          <h1>サインアップ</h1>
          <form id="signup-form">
            <div class="form-group">
              <label for="username">ユーザー名</label>
              <input
                type="text"
                id="username"
                name="name"
                class="form-input"
                required
                placeholder="ユーザー名"
              />
            </div>
            <div class="form-group">
              <label for="email">メールアドレス</label>
              <input
                type="email"
                id="email"
                name="email"
                class="form-input"
                required
                placeholder="example@example.com"
              />
            </div>
            <div class="form-group">
              <label for="password">パスワード</label>
              <input
                type="password"
                id="password"
                name="password"
                class="form-input"
                required
                placeholder="パスワード（8文字以上）"
                minlength={8}
              />
            </div>
            <div class="form-group">
              <button type="submit" class="btn btn-primary">
                サインアップ
              </button>
            </div>
            <div class="error-message" id="error-message" style="display: none;"></div>
          </form>
          <div class="form-footer">
            <p>
              既にアカウントをお持ちの方は <a href="/login">ログイン</a>
            </p>
            <p>
              <a href="/welcome">トップページに戻る</a>
            </p>
          </div>
        </div>
      </div>
      {html`
        <script>
          document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const name = formData.get('name');
            const email = formData.get('email');
            const password = formData.get('password');

            try {
              const response = await fetch('/api/auth/sign-up/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
              });

              if (response.ok) {
                window.location.href = '/';
              } else {
                const error = await response.json();
                document.getElementById('error-message').textContent = error.message || '登録に失敗しました';
                document.getElementById('error-message').style.display = 'block';
              }
            } catch (error) {
              document.getElementById('error-message').textContent = '登録に失敗しました';
              document.getElementById('error-message').style.display = 'block';
            }
          });
        </script>
      `}
    </>,
    { title: 'サインアップ - Picture Gallery', showNav: false }
  );
});

// ログアウト
app.get('/logout', requireAuth, async (c) => {
  const auth = createAuth(c.env);
  await auth.api.signOut({ headers: c.req.raw.headers });
  return c.redirect('/welcome');
});

// 画像一覧ページ（ログイン必須）
app.get('/', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const allPictures = await db
    .select()
    .from(picture)
    .orderBy(desc(picture.createdAt));

  return c.render(
    <div class="gallery-container">
      <div class="container">
        <ul class="gallery-grid">
          {allPictures.map((picture) => (
            <li class="gallery-card">
              <img
                src={`/api/images/${picture.imagePath}`}
                alt={picture.title}
                class="gallery-image"
              />
              <div class="gallery-card-body">
                <h3 class="gallery-title">{picture.title}</h3>
                <div class="gallery-actions">
                  <div class="gallery-buttons">
                    <a href={`/detail/${picture.id}`} class="btn-small">
                      詳細
                    </a>
                  </div>
                  <a href={`/user/${picture.userId}`} class="gallery-username">
                    by {picture.userName}
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    { title: '共有画像 - Picture Gallery', username: user!.name }
  );
});

// 画像アップロードページ
app.get('/upload', requireAuth, async (c) => {
  const user = c.get('user');

  return c.render(
    <div class="content-container">
      <div class="container">
        <div class="content-box">
          <h2>画像のアップロード</h2>
          <p>タイトルと本文を入力、画像を選択して［アップロード］をクリックしてください。</p>
          <p style="margin-bottom: 25px; font-size: 0.9em; color: #666;">
            ※ アップロード可能な画像形式：PNG、JPG、JPEG、GIF、WebP（最大1.5MB）
          </p>
          <form method="post" action="/upload" enctype="multipart/form-data">
            <div class="form-group">
              <label for="title">タイトル</label>
              <input
                type="text"
                id="title"
                name="title"
                class="form-input"
                required
                placeholder="タイトル"
              />
            </div>
            <div class="form-group">
              <label for="contents">メッセージ</label>
              <textarea
                id="contents"
                name="contents"
                class="form-input"
                placeholder="メッセージ"
              ></textarea>
            </div>
            <div class="form-group">
              <label for="image">画像ファイル</label>
              <input
                type="file"
                id="image"
                name="image"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                required
              />
            </div>
            <div class="form-group">
              <button type="submit" class="btn btn-primary">
                アップロード
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    { title: 'アップロード - Picture Gallery', username: user!.name }
  );
});

// 画像アップロード処理
app.post('/upload', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const formData = await c.req.formData();

  const title = formData.get('title') as string;
  const contents = formData.get('contents') as string;
  const imageFileEntry = formData.get('image');

  if (!title || !imageFileEntry || typeof imageFileEntry === 'string') {
    return c.text('タイトルと画像は必須です', 400);
  }

  const imageFile = imageFileEntry as File;

  // ファイルサイズチェック（1.5MB）
  if (imageFile.size > 1.5 * 1024 * 1024) {
    return c.text('ファイルサイズは1.5MB以下にしてください', 400);
  }

  // ファイル名を生成（UUID風）
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = imageFile.name.split('.').pop();
  const fileName = `${timestamp}-${randomStr}.${ext}`;

  // R2バケットにアップロード
  try {
    await c.env.BUCKET.put(fileName, imageFile.stream(), {
      httpMetadata: {
        contentType: imageFile.type,
      },
    });

    // DBに保存
    await db.insert(picture).values({
      userId: user!.id,
      userName: user!.name,
      title,
      contents: contents || '',
      imagePath: fileName,
    });

    return c.redirect('/mypage');
  } catch (error) {
    console.error('Upload error:', error);
    return c.text('アップロードに失敗しました', 500);
  }
});

// マイページ
app.get('/mypage', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');

  const myPictures = await db
    .select()
    .from(picture)
    .where(eq(picture.userId, user!.id))
    .orderBy(desc(picture.createdAt));

  return c.render(
    <div class="gallery-container">
      <div class="container">
        <h2 style="margin-bottom: 2rem; color: #333;">私のアップロード済み一覧</h2>
        <ul class="gallery-grid">
          {myPictures.map((picture) => (
            <li class="gallery-card">
              <img
                src={`/api/images/${picture.imagePath}`}
                alt={picture.title}
                class="gallery-image"
              />
              <div class="gallery-card-body">
                <h3 class="gallery-title">{picture.title}</h3>
                <div class="gallery-actions">
                  <div class="gallery-buttons">
                    <a href={`/detail/${picture.id}`} class="btn-small">
                      詳細
                    </a>
                  </div>
                  <a
                    href={`/delete/${picture.id}`}
                    class="btn-delete-icon"
                    onclick="return confirm('本当に削除しますか？');"
                    title="削除"
                  >
                    🗑️
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    { title: 'マイページ - Picture Gallery', username: user!.name }
  );
});

// ユーザーの投稿一覧
app.get('/user/:userId', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const userId = parseInt(c.req.param('userId'));

  const userPictures = await db
    .select()
    .from(picture)
    .where(eq(picture.userId, userId))
    .orderBy(desc(picture.createdAt));

  const targetUser = userPictures[0]?.userName || 'Unknown';

  return c.render(
    <div class="gallery-container">
      <div class="container">
        <h2 style="margin-bottom: 2rem; color: #333;">
          {targetUser} さんの投稿一覧
        </h2>
        <ul class="gallery-grid">
          {userPictures.map((picture) => (
            <li class="gallery-card">
              <img
                src={`/api/images/${picture.imagePath}`}
                alt={picture.title}
                class="gallery-image"
              />
              <div class="gallery-card-body">
                <h3 class="gallery-title">{picture.title}</h3>
                <div class="gallery-actions">
                  <div class="gallery-buttons">
                    <a href={`/detail/${picture.id}`} class="btn-small">
                      詳細
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    { title: `${targetUser}の投稿 - Picture Gallery`, username: user!.name }
  );
});

// 詳細ページ
app.get('/detail/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  const pictureResult = await db
    .select()
    .from(picture)
    .where(eq(picture.id, id))
    .limit(1);

  if (pictureResult.length === 0) {
    return c.text('画像が見つかりません', 404);
  }

  const detail = pictureResult[0];

  return c.render(
    <div class="content-container">
      <div class="container">
        <div class="content-box">
          <h2>{detail.title}</h2>
          <h4>{detail.contents}</h4>
          <img
            src={`/api/images/${detail.imagePath}`}
            alt={detail.title}
            class="detail-image"
          />
          <p style="color: #999; font-size: 0.875rem; margin-top: 1rem;">
            投稿日時: {new Date(detail.createdAt!).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
          </p>
        </div>
      </div>
    </div>,
    { title: `${detail.title} - Picture Gallery`, username: user!.name }
  );
});

// 削除処理
app.get('/delete/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  // 削除対象を取得
  const pictureResult = await db
    .select()
    .from(picture)
    .where(eq(picture.id, id))
    .limit(1);

  if (pictureResult.length === 0) {
    return c.text('画像が見つかりません', 404);
  }

  // 自分の投稿のみ削除可能
  if (pictureResult[0].userId !== Number(user!.id)) {
    return c.text('削除権限がありません', 403);
  }

  // R2から画像を削除
  try {
    await c.env.BUCKET.delete(pictureResult[0].imagePath);
  } catch (error) {
    console.error('Failed to delete from R2:', error);
  }

  // DBから削除
  await db.delete(picture).where(eq(picture.id, id));

  return c.redirect('/mypage');
});

// 画像配信API
app.get('/api/images/:fileName', async (c) => {
  const fileName = c.req.param('fileName');

  try {
    const object = await c.env.BUCKET.get(fileName);

    if (!object) {
      return c.text('Image not found', 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=604800',
        'Cloudflare-CDN-Cache-Control': 'private, max-age=0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return c.text('Failed to fetch image', 500);
  }
});

export default app;
