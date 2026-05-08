# gstack 학습용 북마크 토이 — 설계

## 1. 목표와 범위

**1차 목표**: gstack 워크플로를 처음부터 끝까지 한 사이클 돌려서 도구 손맛을 익힌다.
제품 출시가 아니라 **학습**이 목표. 12개 이상의 gstack 스킬이 의미있게 발화되는
최소한의 풀스택 토이를 만든다.

**범위 (in scope)**:
- 반응형 웹 풀스택 (백엔드 + SSR 프론트, 모바일 브라우저 대응)
- 인증 (이메일+비밀번호)
- 북마크 CRUD + 태그
- 공개 프로필 페이지 (`/u/<username>`)
- URL 추가 시 OG 메타 자동 fetch
- 공개 배포 (Fly.io)

**범위 외 (out of scope)**:
- iOS / Android 네이티브 앱
- OAuth/소셜 로그인, 매직 링크
- 검색, import/export, 동적 OG 카드 생성
- 공유 기능 외 협업 기능
- 다국어 (UI 한국어 1개)

**시간 예산**: ~1일 (gstack 한 사이클).

---

## 2. 기술 스택

| 레이어 | 선택 | 이유 |
|---|---|---|
| 런타임 | bun | gstack 자체가 bun. 같은 환경에서 테스트/실행이 가장 매끄러움 |
| 웹 프레임워크 | Hono | Express 수준의 얇은 라우터. 마법이 적어 `/review`, `/investigate`가 추적하기 쉬움 |
| 템플릿 | Hono/JSX | SSR HTML, 자동 escape. React 안 씀 |
| 클라이언트 JS | HTMX (~11KB) | 작은 인터랙션용. SPA 안 만듦 |
| ORM | Drizzle | 타입 안전 + libSQL/SQLite 지원 |
| DB | Turso (libSQL) | SQLite at edge, 무료 티어 |
| Auth | 자체 구현 (`bun.password` + HMAC 서명 쿠키) | Lucia는 2025 deprecated. 코드가 짧고 `/cso`가 검사하기 좋음 |
| 호스팅 | Fly.io | gstack `/setup-deploy`가 잘 지원, bun과 친화적 |
| 테스트 | `bun:test` + Hono `app.request()` | 추가 의존성 없음 |
| E2E | gstack `/qa` (내장 Chromium) | 별도 Playwright 안 깔음 |

**왜 SSR + 클라이언트 프레임워크 없음?**
- `/benchmark`의 Web Vitals: client JS가 적을수록 점수가 좋음
- `/qa`: HTML form 테스트가 단순. SPA state 디버깅으로 시간 안 뺏김
- `/design-review`: 진짜 CSS 문제만 보임. React 렌더링 함정 없음
- gstack을 배우는 게 목적이지 React를 배우는 게 아님

---

## 3. 아키텍처

```
Browser
  ↕ HTML over HTTP (form POST + HTMX swap)
Hono app (bun, Fly.io)
  - Routes (§4)
  - Hono/JSX 템플릿 (SSR)
  - Drizzle ORM → libSQL 클라이언트
  - 자체 password hash (bun.password.hash, argon2id)
  - HMAC 서명 쿠키 세션 (DB의 sessions 테이블 lookup)
  - OG fetch: bun.fetch + 작은 HTML 메타 파서
  ↕ libSQL 와이어 프로토콜 (HTTPS)
Turso (libSQL/SQLite at edge)
```

**프로젝트 구조** (단일 패키지):

```
src/
  app.ts              # Hono app 인스턴스, 미들웨어
  routes/
    auth.ts           # /auth/*
    app.ts            # /app/*
    public.ts         # /u/:username, /
    health.ts         # /healthz
  views/              # Hono/JSX 컴포넌트
    layout.tsx
    landing.tsx
    auth.tsx          # 로그인 / 가입 폼
    dashboard.tsx     # /app
    bookmark-form.tsx
    public-profile.tsx
  db/
    client.ts         # libSQL + Drizzle
    schema.ts
    migrations/
  lib/
    auth.ts           # session, password
    csrf.ts           # HMAC 토큰
    og-fetch.ts       # SSRF 가드 + OG 파서
    ssrf-guard.ts     # 사설 IP 차단
    validate.ts       # Zod 스키마
  test/
    *.test.ts
public/
  htmx.min.js
  styles.css
fly.toml
Dockerfile
package.json
```

---

## 4. 라우트

| Method | Path | 무엇 |
|---|---|---|
| GET | `/` | 랜딩 (로그인/가입 안내) |
| POST | `/auth/signup` | 가입 |
| POST | `/auth/login` | 로그인 |
| POST | `/auth/logout` | 로그아웃 |
| GET | `/app` | 본인 북마크 목록 (인증 필수). 태그 필터 쿼리 |
| POST | `/app/bookmarks` | 추가 (URL → OG fetch → 저장) |
| POST | `/app/bookmarks/:id` | 수정 (제목/태그/공개여부) |
| POST | `/app/bookmarks/:id/delete` | 삭제 |
| GET | `/u/:username` | 공개 프로필 — `is_public=1` 북마크만 |
| GET | `/healthz` | 200 "ok" — Fly health check + `/canary` |

**MVP 라우트 = 10개. 더 늘리지 않는다.**

---

## 5. 데이터 모델

### 스키마 (SQLite + Drizzle)

```sql
users
  id            TEXT PK              -- ULID
  username      TEXT UNIQUE          -- 소문자, [a-z0-9_-]{3,20}
  email         TEXT UNIQUE          -- 소문자
  password_hash TEXT                 -- bun.password.hash (argon2id)
  created_at    INTEGER              -- unix ms

sessions
  id            TEXT PK              -- 32바이트 hex, 곧 쿠키값
  user_id       TEXT FK → users.id ON DELETE CASCADE
  expires_at    INTEGER              -- unix ms
  created_at    INTEGER

bookmarks
  id            TEXT PK              -- ULID
  user_id       TEXT FK → users.id ON DELETE CASCADE
  url           TEXT                 -- http/https만, ≤2048
  title         TEXT                 -- ≤200
  description   TEXT NULL            -- ≤500
  og_image_url  TEXT NULL            -- ≤2048
  is_public     INTEGER              -- 0/1
  created_at    INTEGER
  updated_at    INTEGER
  INDEX (user_id, created_at DESC)
  INDEX (user_id, is_public)

tags                                 -- 유저별 태그 네임스페이스
  id            TEXT PK
  user_id       TEXT FK ON DELETE CASCADE
  name          TEXT                 -- 소문자, ≤30
  UNIQUE (user_id, name)

bookmark_tags
  bookmark_id   TEXT FK ON DELETE CASCADE
  tag_id        TEXT FK ON DELETE CASCADE
  PK (bookmark_id, tag_id)
```

---

## 6. 보안 경계

`/cso`가 검사할 항목들 — 미리 잘 짜두면 깨끗하게 통과한다.

1. **비밀번호** — `bun.password.hash(pw)` (argon2id 기본). 로그에 절대 안 남김.
2. **세션 쿠키** — `HttpOnly; Secure (prod); SameSite=Lax; Path=/`. 쿠키값은 불투명 세션 ID. 유저 정보 X.
3. **세션 만료** — 생성 시 `expires_at = now + 30일`. 매 요청마다 만료 검사.
   로그아웃은 sessions 행 삭제. 만료된 세션 cleanup은 cron 대신 lazy 삭제 (조회 시 만료면 401 + 삭제).
4. **CSRF** — POST form에 HMAC 서명 hidden token. SameSite=Lax + 토큰 이중 방어.
5. **SSRF (OG fetch)** — 유저가 임의 URL 입력:
   - 사설 IP 차단: `10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `fe80::/10`, `0.0.0.0`, link-local
   - http/https 외 차단
   - `redirect: 'manual'` + 리다이렉트 재검증 (각 hop마다 IP 재확인)
   - 5초 timeout, 1MB body 상한
6. **XSS** — Hono/JSX 자동 escape. dangerouslySetInnerHTML 안 씀.
7. **SQL injection** — Drizzle 파라미터 바인딩. raw SQL 안 씀.
8. **유저 enumeration** — 로그인/가입 에러는 일반 메시지. "이메일이 존재합니다" X. (가입 시 username 중복은 알릴 수밖에 없으나 공개 정보임)
9. **OG 이미지 프록시 X** — URL만 저장. 브라우저가 직접 로드. 프록시는 또 다른 SSRF 표면.
10. **Rate limit** — MVP 생략. README에 TODO.

---

## 7. 핵심 데이터 흐름

### A. 가입 → 로그인 → 첫 북마크

```
POST /auth/signup
  ├─ Zod 검증 (username 정규식, email 형식, pw≥8)
  ├─ INSERT users (password_hash = bun.password.hash(pw))
  ├─ 새 session 생성 → 쿠키 set
  └─ 302 → /app

POST /app/bookmarks {url, tags?, is_public}
  ├─ CSRF 토큰 검증
  ├─ session lookup → user_id
  ├─ URL 검증 (http/https, 사설 IP 차단)
  ├─ OG fetch (5s timeout, 1MB cap, redirect manual)
  │   └─ 실패해도 url만으로 저장 (title=url)
  ├─ INSERT bookmark + tag 연결 (트랜잭션)
  └─ 302 → /app (flash: "추가됨")
```

### B. 공개 프로필

```
GET /u/:username
  ├─ user 조회 (없으면 404)
  ├─ bookmarks WHERE user_id=? AND is_public=1 ORDER BY created_at DESC
  └─ SSR HTML (Cache-Control: public, max-age=60, stale-while-revalidate=300)
```

### C. 로그아웃

```
POST /auth/logout
  ├─ DELETE FROM sessions WHERE id = cookie
  ├─ Set-Cookie 만료
  └─ 302 → /
```

---

## 8. 에러 처리

- **검증 실패** — 같은 폼에 inline 에러로 200 응답 (302 X)
- **인증 실패** — 일반 메시지 ("invalid credentials"), 200
- **OG fetch 실패** — 북마크는 저장되되 title=url, description=null
- **DB 에러** — 500 + 일반 페이지. 서버 로그에 structured JSON (`{level, ts, route, err}`)
- **404** — 명시적 페이지 (특히 `/u/존재하지않는유저`)
- **CSRF 토큰 실패** — 403
- **Rate-limit 위반** (post-MVP) — 429

---

## 9. 테스트 전략

| 레벨 | 도구 | 무엇 |
|---|---|---|
| Unit | `bun:test` | SSRF guard (사설 IP 표 검증), password verify, CSRF HMAC, URL/username/email 검증 |
| Integration | `bun:test` + Hono `app.request()` | 한 시나리오 — 가입→로그인→북마크 추가→공개 페이지 노출 |
| E2E (수동) | gstack `/qa` | 실제 헤드리스 브라우저로 폼 입력/제출, 모바일 viewport 포함 |

**Unit + Integration은 코드와 함께 작성, E2E는 `/qa`로만 돌림** (별도 Playwright 안 설치).

---

## 10. gstack 워크플로 발화 체크리스트

이 토이를 만들면서 다음 도구가 의미있게 실행된다:

| 단계 | 도구 | 이 토이에서 무엇이 잡힐까 |
|---|---|---|
| 계획 | `/plan-eng-review` | 트랜잭션 누락, 인덱스 누락, OG fetch 동기/비동기 결정 |
| 계획 | `/plan-design-review` | 빈 상태(empty state), 모바일 폼, 긴 URL 처리 |
| 디자인 | `/design-consultation` | DESIGN.md 만들기 (색/타이포/간격) |
| 구현 (TDD) | `bun:test` | unit + integration |
| 두번째 의견 | `/codex review` | 보안 SSRF 빼먹은 거 잡힐 가능성 |
| QA | `/qa` | 에러 메시지 enumeration, 중복 가입, 빈 폼 제출 |
| 시각 QA | `/design-review` | 모바일 빈 상태, 긴 URL 줄바꿈, 한국어 폰트 |
| 보안 | `/cso` | CSRF, SSRF, password 로그, 세션 만료 |
| 코드 리뷰 | `/review` | SQL trust 경계, Drizzle 사용 패턴 |
| 배포 준비 | `/setup-deploy` | Fly.io 자동 감지 |
| 배포 | `/ship` + `/land-and-deploy` | PR → main → Fly 배포 → /healthz 확인 |
| 운영 | `/canary`, `/benchmark` | 배포 후 LCP/CLS, 콘솔 에러 |
| 회고 | `/retro`, `/learn` | 무엇을 배웠는지 기록, 다음번 개선점 |

**13개 도구가 의미있게 발화 = 학습 ROI 충분.**

---

## 11. Phase 0 (사전 준비)

코드 작성 전에 필요한 것:

1. **Turso 계정** — `turso auth signup` → DB 생성 → connection string 받기
2. **Fly.io 계정** — `fly auth signup` → 결제카드 등록 (무료 티어 안에서 동작)
3. **bun 설치** — 이미 있음 (1.3.13)
4. **환경변수** (`.env`):
   - `TURSO_URL`
   - `TURSO_TOKEN`
   - `SESSION_SECRET` (HMAC 키, 32바이트 random)
   - `CSRF_SECRET` (HMAC 키)

---

## 12. 성공 기준

다음이 모두 사실이면 학습 사이클 성공:

- [ ] 공개 URL이 살아있고 모바일에서 보임
- [ ] 가입 → 로그인 → 북마크 추가 → 공개 프로필 노출의 전체 흐름이 동작
- [ ] `/cso` 출력에 critical/high가 없음
- [ ] `/qa` 출력에 critical/high 버그 없음
- [ ] `/benchmark`에서 LCP < 2.5s
- [ ] §10의 13개 도구를 최소 한 번씩 실행해봄
- [ ] `/retro` 또는 `/learn`에 배운 점 1개 이상 기록
