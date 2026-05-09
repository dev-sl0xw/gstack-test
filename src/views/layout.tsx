import type { FC } from "hono/jsx";

export const Layout: FC<{ title: string; children?: any }> = ({ title, children }) => (
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>{children}</body>
  </html>
);
