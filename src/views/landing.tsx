import { Layout } from "./layout.tsx";

export function Landing({ user }: { user: { username: string } | null }) {
  return (
    <Layout title="bookmarks">
      <main class="landing">
        <h1>북마크 토이</h1>
        <p>링크를 모으고 공개 프로필로 공유합니다.</p>
        {user
          ? <p><a href="/app">내 북마크 →</a></p>
          : (
            <p>
              <a href="/auth/signup">가입</a> 또는 <a href="/auth/login">로그인</a>
            </p>
          )
        }
      </main>
    </Layout>
  );
}
