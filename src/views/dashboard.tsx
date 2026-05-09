import { Layout } from "./layout.tsx";

const FLASH_MESSAGES: Record<string, string> = {
  added: "북마크를 추가했어요",
  updated: "북마크를 수정했어요",
  deleted: "북마크를 삭제했어요",
  invalid: "입력값을 확인해주세요",
};

export type DashBookmark = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  isPublic: number;
  tags: string[];
};

export function Dashboard({
  username, bookmarks, csrfToken, flash,
}: {
  username: string;
  bookmarks: DashBookmark[];
  csrfToken: string;
  flash?: string;
}) {
  return (
    <Layout title={`${username}의 북마크`}>
      <header class="topbar">
        <a href={`/u/${username}`}>공개 프로필 보기</a>
        <form method="post" action="/auth/logout" style="display:inline">
          <button type="submit">로그아웃</button>
        </form>
      </header>

      <main class="dash">
        <h1>내 북마크</h1>
        {flash ? <p class="flash">{FLASH_MESSAGES[flash] ?? flash}</p> : null}

        <form method="post" action="/app/bookmarks" class="add">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="url" name="url" placeholder="https://..." required />
          <input type="text" name="tags" placeholder="태그를 쉼표로" />
          <label><input type="checkbox" name="is_public" /> 공개</label>
          <button type="submit">추가</button>
        </form>

        {bookmarks.length === 0
          ? <p class="empty">아직 북마크가 없어요.</p>
          : (
            <ul class="bookmarks">
              {bookmarks.map((b) => (
                <li>
                  <a href={b.url} target="_blank" rel="noopener noreferrer">{b.title}</a>
                  {b.description ? <p>{b.description}</p> : null}
                  <div class="meta">
                    {b.tags.map((t) => <span class="tag">#{t}</span>)}
                    {b.isPublic ? <span class="badge">공개</span> : null}
                  </div>
                  <div class="actions">
                    <a href={`/app/bookmarks/${b.id}/edit`} class="action">수정</a>
                    <form method="post" action={`/app/bookmarks/${b.id}/delete`} style="display:inline">
                      <input type="hidden" name="_csrf" value={csrfToken} />
                      <button type="submit">삭제</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </main>
    </Layout>
  );
}
