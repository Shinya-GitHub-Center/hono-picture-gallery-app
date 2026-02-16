import { jsxRenderer } from 'hono/jsx-renderer';
import { Link, ViteClient } from 'vite-ssr-components/hono';

// props第2引数を追加するため型定義を拡張
declare module 'hono' {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      props?: {
        title?: string;
        showNav?: boolean;
        username?: string;
      }
    ): Response | Promise<Response>;
  }
}

export const renderer = jsxRenderer(({ children, title, showNav = true, username }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title || 'Picture Gallery'}</title>
        <link rel="icon" type="image/x-icon" href="/favicon.svg" />
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
      </head>
      <body>
        {showNav && (
          <nav class="navbar">
            <div class="container navbar-container">
              <div class="navbar-left">
                <a href="/" class="brand">Picture Gallery</a>
                {username && <span class="welcome-message">@{username}</span>}
              </div>
              <div class="nav-menu">
                <a href="/upload">投稿</a>
                {username && (
                  <>
                    <a href="/mypage">マイページ</a>
                    <a href="/logout">ログアウト</a>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
        <main>{children}</main>
        <footer class="footer">
          <div class="container">
            <p>Copyright &copy; 2026 - Picture Gallery App</p>
          </div>
        </footer>
      </body>
    </html>
  );
});
