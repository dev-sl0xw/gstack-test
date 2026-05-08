import { Layout } from "./layout.tsx";

export function PublicProfile({
  username,
  bookmarks,
}: {
  username: string;
  bookmarks: { url: string; title: string; description: string | null; tags: string[] }[];
}) {
  return (
    <Layout title={`@${username}의 공개 북마크`}>
      <main class="public">
        <h1>@{username}</h1>
        {bookmarks.length === 0
          ? <p class="empty">아직 공개된 북마크가 없어요.</p>
          : (
            <ul class="bookmarks">
              {bookmarks.map((b) => (
                <li>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
                  {b.description ? <p>{b.description}</p> : null}
                  <div class="meta">{b.tags.map((t) => <span class="tag">#{t}</span>)}</div>
                </li>
              ))}
            </ul>
          )
        }
      </main>
    </Layout>
  );
}
