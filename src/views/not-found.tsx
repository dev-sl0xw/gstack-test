import { Layout } from "./layout.tsx";

export function NotFound() {
  return (
    <Layout title="페이지를 찾을 수 없어요">
      <main class="not-found">
        <h1>페이지를 찾을 수 없어요</h1>
        <p>주소가 잘못되었거나 삭제된 페이지일 수 있어요.</p>
        <p><a href="/">홈으로</a></p>
      </main>
    </Layout>
  );
}
