import { Layout } from "./layout.tsx";
import type { DashBookmark } from "./dashboard.tsx";

export function BookmarkEdit({ b, csrfToken }: { b: DashBookmark; csrfToken: string }) {
  return (
    <Layout title="북마크 수정">
      <main class="edit">
        <h1>북마크 수정</h1>
        <form method="post" action={`/app/bookmarks/${b.id}`}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <label>URL<input type="url" name="url" value={b.url} required /></label>
          <label>제목<input name="title" value={b.title} required /></label>
          <label>설명<textarea name="description">{b.description ?? ""}</textarea></label>
          <label>태그<input name="tags" value={b.tags.join(", ")} /></label>
          <label><input type="checkbox" name="is_public" checked={b.isPublic === 1} /> 공개</label>
          <button type="submit">저장</button>
          <a href="/app">취소</a>
        </form>
      </main>
    </Layout>
  );
}
