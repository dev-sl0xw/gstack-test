import { Layout } from "./layout.tsx";

export function SignupForm({ error }: { error?: string }) {
  return (
    <Layout title="가입">
      <main class="auth">
        <h1>가입</h1>
        {error ? <p class="error">{error}</p> : null}
        <form method="post" action="/auth/signup">
          <label>username<input name="username" required /></label>
          <label>email<input type="email" name="email" required /></label>
          <label>password<input type="password" name="password" required minlength={8} /></label>
          <button type="submit">가입하기</button>
        </form>
        <p><a href="/auth/login">이미 계정이 있어요</a></p>
      </main>
    </Layout>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <Layout title="로그인">
      <main class="auth">
        <h1>로그인</h1>
        {error ? <p class="error">{error}</p> : null}
        <form method="post" action="/auth/login">
          <label>email<input type="email" name="email" required /></label>
          <label>password<input type="password" name="password" required /></label>
          <button type="submit">로그인</button>
        </form>
        <p><a href="/auth/signup">가입하기</a></p>
      </main>
    </Layout>
  );
}
