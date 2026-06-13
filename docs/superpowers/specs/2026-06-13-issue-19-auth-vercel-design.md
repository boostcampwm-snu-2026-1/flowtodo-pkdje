# #19 — Vercel + Atlas 배포 + GitHub OAuth 인증 Design

**Status:** Approved (user delegated decisions)
**Issue:** #19
**Depends on:** Week 2 모든 머지

## 1. Goal

flowtodo 를 Vercel 에 배포하고, GitHub OAuth 로그인을 통해 사용자별 task 격리를 구현한다. 멘토 조언의 "사용자별 인증" 부분을 채택. nginx/Vite/filesystem 은 다음 프로젝트로 deferral.

## 2. Architecture

```
NextAuth.js v4 (Auth.js) + GitHub OAuth + JWT session + Vercel + MongoDB Atlas
```

### 핵심 결정

| # | Decision | Why |
|---|----------|-----|
| 1 | NextAuth.js v4 | App Router 안정 지원. v5 는 beta. |
| 2 | GitHub provider only (Google 미포함) | 부캠 평가자=개발자. Google 추가는 +30분 가능. |
| 3 | JWT session (database session 미사용) | adapter/세션 컬렉션 불필요. user.id 는 JWT payload 에 박음. |
| 4 | userId = GitHub profile.id (string) | 안정적. email 변경에도 불변. |
| 5 | Task 도메인 함수 시그니처에 userId 추가 | 격리 진입점 단일화. 망각 시 컴파일 에러. |
| 6 | middleware 는 페이지 (`/`) 만, API 는 route 내부 session 체크 | API 가 redirect 받으면 fetch 가 어색. |
| 7 | 기존 데이터 wipe (마이그레이션 스크립트 없음) | dev/데모 환경. 본인 OAuth 로그인 후 다시 만들면 됨. |
| 8 | recommender 무변경 | 받는 tasks 가 이미 본인 것뿐. |

### 데이터 흐름

```
[브라우저] ─ GET /
    │
    ▼ middleware.ts (NextAuth withAuth)
    │
    ├─ 미로그인 → /api/auth/signin?callbackUrl=/ (GitHub OAuth → JWT cookie)
    │
    └─ 로그인 → page 렌더
                  │
                  ▼ fetch /api/tasks
              getServerSession(authOptions) → session.user.id
              ├─ 401 if missing
              └─ listTasks(userId) → MongoDB { userId } 필터
```

## 3. Files

### 신규
- `lib/auth.ts` — `authOptions` (providers, callbacks, JWT/session 매핑) + `getCurrentUserId(req?)` 헬퍼
- `types/next-auth.d.ts` — Session/JWT 타입에 `id: string` 추가
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler (`GET`, `POST` export)
- `middleware.ts` — `withAuth` matcher = `/`
- `app/components/AuthSessionProvider.tsx` — client wrapper. layout 이 server 유지하게 함.

### 수정
- `app/layout.tsx` — `<AuthSessionProvider>` 로 children 감쌈
- `app/components/Header.tsx` — `useSession()` + 우상단 아바타/이름/로그아웃
- `lib/tasks.ts` — `Task.userId` 추가. `TaskDoc.userId` 추가. 모든 함수 시그니처: `listTasks(userId)`, `createTask(userId, input)`, `updateTask(userId, id, patch)`, `deleteTask(userId, id)`. cascade detach 도 `userId` 필터.
- `lib/tasks.test.ts` — 모든 케이스에 `userId` 인자 + 격리 테스트 1~2개 추가
- `app/api/tasks/route.ts` — `getServerSession` → 401 또는 `userId` 전달
- `app/api/tasks/[id]/route.ts` — 동일 패턴
- `app/page.tsx` — server component 에서 session 강제 (middleware 가 가드하지만 ServerComponent 의 user 표시용으로도 session 추출 가능)
- `.env.example` — `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET` 추가
- `README.md` — GitHub OAuth App 등록 가이드 + Vercel 배포 가이드 + 환경변수 표

### 무변경
- `lib/recommender.ts`, `lib/dag.ts`, `lib/store.ts`, `lib/mongo.ts`
- React Flow / Canvas / TaskDrawer / CreateTaskModal / NextQuestPanel

## 4. 인증 흐름

```ts
// lib/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, profile, account }) {
      if (account && profile) {
        token.id = String((profile as { id?: number | string }).id ?? token.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    },
  },
};

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
```

## 5. DB 스키마 변경

`TaskDoc`:
```ts
type TaskDoc = {
  _id: ObjectId;
  userId: string;      // NEW — GitHub profile.id
  title: string;
  status: Status;
  priority: Priority;
  prerequisites: ObjectId[];
  dueDate?: Date;
  description?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

인덱스 (배포 후 한 번): `{ userId: 1 }` 단일. Atlas 콘솔에서 또는 코드에서 ensureIndex.

## 6. 사이클 가드 / 추천

- `listTasks(userId)` 가 본인 task 만 반환 → recommender 가 받는 input 도 본인 것뿐 → 변경 없음.
- `wouldCreateCycle` 도 동일. 타 사용자 task id 가 prereq 로 들어올 일 없음 (UI 가 본인 task 만 노출).

## 7. UI

### Header 우상단 추가
```
[+ 새 태스크]  [⚙ 설정]  ┃  [👤 박동제 ▾]  ← 클릭 시 로그아웃 메뉴
```

Header 가 이미 `'use client'`. `useSession()` 으로 session 받음.

### 로그인 페이지
- NextAuth 기본 페이지 사용 (`/api/auth/signin`). 커스텀은 #18 polish.

## 8. Testing

- `lib/tasks.test.ts` — 모든 호출에 dummy `userId` 추가
- 신규: "userA 의 task 는 userB 의 listTasks 결과에 안 포함" 1 케이스
- 신규: "userA 가 userB 의 task 를 update/delete 시도 → not found" 2 케이스
- `lib/recommender.test.ts` — 무변경 (순수 함수)
- `lib/dag.test.ts` — 무변경

새 baseline 추정: 43 → 46 (3 신규)

## 9. Vercel 배포

### 환경변수 (Vercel 대시보드)
| 변수 | 값 |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 결과 |
| `NEXTAUTH_URL` | `https://<vercel-domain>` |
| `GITHUB_ID` | OAuth App Client ID |
| `GITHUB_SECRET` | OAuth App Client Secret |

### GitHub OAuth App 등록 (사용자 수동)
- https://github.com/settings/developers → New OAuth App
- Homepage: `https://<vercel-domain>`
- Callback: `https://<vercel-domain>/api/auth/callback/github`

### 로컬 dev 용 별도 OAuth App
- Homepage: `http://localhost:3000`
- Callback: `http://localhost:3000/api/auth/callback/github`

(prod/dev 분리 권장 — README 에 명시)

## 10. Out of Scope

- Google OAuth (필요시 30분 추가)
- 커스텀 로그인 페이지 → #18 polish
- 사용자별 설정 (가중치 슬라이더 #17 의 영구 저장)
- 팀/협업 기능
- 데이터 export/import
- 사용자 프로필 페이지
- 비밀번호 인증 (OAuth 만)
