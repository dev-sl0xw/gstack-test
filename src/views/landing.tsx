import { Layout } from "./layout.tsx";

export function Landing({ user }: { user: { username: string } | null }) {
  return (
    <Layout title="bookmarks">
      <main class="landing">
        <h1>북마크 토이</h1>
        <p class="lede">링크를 모으고 공개 프로필로 공유합니다.</p>
        {user
          ? (
            <div class="cta">
              <a href="/app" class="cta-primary">내 북마크 →</a>
            </div>
          )
          : (
            <div class="cta">
              <a href="/auth/signup" class="cta-primary">가입하기</a>
              <a href="/auth/login" class="cta-secondary">로그인</a>
            </div>
          )
        }
      </main>
    </Layout>
  );
}
