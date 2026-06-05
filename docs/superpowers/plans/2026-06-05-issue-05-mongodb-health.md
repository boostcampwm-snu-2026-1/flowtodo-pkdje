# Issue #5 — MongoDB 연결 + Health API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MongoDB Atlas 무료 cluster 에 연결하는 싱글톤 모듈(`lib/mongo.ts`)과 DB ping 결과를 반환하는 `GET /api/health` 엔드포인트를 추가해, 이후 이슈(#6 CRUD API 등)가 DB 접근 인프라 위에서 동작하도록 한다.

**Architecture:** MongoDB 공식 권장 Next.js 패턴 — `MongoClient` 인스턴스를 모듈 레벨에서 만들고, 개발 환경에서는 hot reload 가 모듈을 재실행해도 같은 client 가 유지되도록 `globalThis` 캐싱. 프로덕션에서는 단순히 모듈 로딩 시 한 번 connect. Health 라우트는 `client.db().admin().ping()` 으로 round-trip 검증 후 JSON 반환.

**Tech Stack:** `mongodb` 6.x driver · Next.js App Router Route Handler · `.env.local` (gitignored) + `.env.example` (committed)

**Issue:** [#5 MongoDB 연결 + Health API](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/5)
**Branch model:** `feature/5-mongo-health → main` (트렁크 기반)

---

## File Structure

| File | Purpose |
|---|---|
| `lib/mongo.ts` | `MongoClient` 싱글톤. `clientPromise` 를 default export — 모든 라우트가 동일 client 공유. dev hot reload 시 `globalThis._mongoClientPromise` 로 재사용. |
| `app/api/health/route.ts` | `GET /api/health` Route Handler. `clientPromise → admin().ping()` 후 `{ ok: true }` 또는 503. |
| `.env.example` | `MONGODB_URI=mongodb+srv://...` 템플릿. 커밋됨 (실제 값 없음). |
| `.env.local` | 본인 머신 전용 실제 URI. **gitignored**, commit 안 됨. |
| `package.json` | `mongodb` 의존성 추가. |

**Not creating:**
- 별도 단위 테스트 모듈 — singleton + 외부 DB 연결은 integration 으로 검증 (`curl /api/health`). 단위 테스트는 #13 (`lib/quest.ts`) 에서 본격 도입.
- DB schema/collection 정의 — #6 에서 도입.

---

## Task 0: Atlas 셋업 + Feature 브랜치

### 0.0 MongoDB Atlas 셋업 (외부, 본인 작업)

본 작업은 코드와 무관한 외부 셋업. 진행 안 됐으면 먼저 완료.

- [ ] **Step 0.0.1: Atlas 계정 + Free Cluster**

1. https://www.mongodb.com/cloud/atlas 가입 (Google/GitHub OAuth 가능)
2. "Build a Database" → **M0 Free Tier** 선택
3. 클라우드 공급자: AWS / 리전: 서울(ap-northeast-2) 또는 가까운 곳
4. Cluster 이름: 기본값 `Cluster0` 유지 OK
5. 생성까지 약 1 ~ 3분

- [ ] **Step 0.0.2: DB 유저 생성**

Database Access → Add New Database User
- Authentication Method: Password
- Username: `flowtodo` (또는 본인 선호)
- Password: 자동 생성 (Copy 해두기)
- Database User Privileges: **Read and write to any database**
- Add User

- [ ] **Step 0.0.3: IP 허용**

Network Access → Add IP Address
- 개발 단계엔 **Allow access from anywhere** (0.0.0.0/0) — 편의상.
  - 보안 우려시: 본인 IP 만. 단 IP 바뀌면 다시 등록 필요.

- [ ] **Step 0.0.4: 연결 문자열 얻기**

Cluster → Connect → Drivers → Node.js
- 표시되는 URI 복사 (예):
  `mongodb+srv://flowtodo:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
- `<password>` 부분을 실제 패스워드로 치환 (URL-encoded).
- DB 이름을 URI 에 명시: `/?retryWrites...` → `/flowtodo?retryWrites...`
- 최종 형태:
  `mongodb+srv://flowtodo:REAL_PASSWORD@cluster0.xxxxx.mongodb.net/flowtodo?retryWrites=true&w=majority`
- 이 문자열을 임시 메모에 보관 (다음 Task 에서 `.env.local` 에 입력).

### 0.1 Feature 브랜치 분기

- [ ] **Step 0.1.1: main 최신 상태 확보**

```bash
git checkout main
git pull origin main
git status --short
```

Expected: `main` 브랜치, status clean.

- [ ] **Step 0.1.2: Feature 브랜치 생성**

```bash
git checkout -b feature/5-mongo-health
```

Expected: `Switched to a new branch 'feature/5-mongo-health'`

---

## Task 1: `mongodb` driver 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1.1: 설치**

```bash
npm install mongodb
```

Expected: `added N packages, audited N+1 packages in Xs`. Peer warning 무시 OK.

- [ ] **Step 1.2: package.json 에 들어갔는지 확인**

```bash
node -e "console.log(require('./package.json').dependencies.mongodb)"
```

Expected: `^6.x.x` 또는 비슷한 버전 문자열.

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mongodb driver (#5)"
```

---

## Task 2: `lib/mongo.ts` 싱글톤 커넥션

**Files:**
- Create: `lib/mongo.ts`

- [ ] **Step 2.1: `lib/mongo.ts` 작성**

```ts
import { MongoClient, type MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    'MONGODB_URI is not set. Define it in .env.local (see .env.example).',
  );
}

const options: MongoClientOptions = {};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // dev: hot reload 가 모듈을 재실행해도 같은 client 를 재사용하기 위해 globalThis 캐싱
  const globalWithMongo = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // prod: 모듈 로딩 시 한 번 connect
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
```

- [ ] **Step 2.2: 타입 검사**

```bash
npm run typecheck
```

Expected: 출력 없음 / exit 0.

만약 실패하면 메시지 보내고, 보통은 `MongoClientOptions` import 경로나 `globalThis` 타입 보강 누락이 원인.

- [ ] **Step 2.3: Commit**

```bash
git add lib/mongo.ts
git commit -m "feat(mongo): add singleton MongoClient with dev hot-reload caching (#5)"
```

---

## Task 3: 환경 변수 (`.env.example` + 본인 머신의 `.env.local`)

**Files:**
- Create: `.env.example`
- Create (본인 머신, 미커밋): `.env.local`

- [ ] **Step 3.1: `.env.example` 작성**

```bash
# .env.example — committed template (no real secrets)
# Copy this file to .env.local and fill in your Atlas connection string.

# MongoDB Atlas connection URI.
# Format: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
# The <dbname> portion must be present so client.db() resolves without arg.
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/flowtodo?retryWrites=true&w=majority
```

- [ ] **Step 3.2: 본인이 `.env.local` 작성**

`.env.local` 은 gitignored. 본인 머신에만 두는 실제 값.

```bash
cp .env.example .env.local
# 에디터로 .env.local 열기
```

`.env.local` 안의 `MONGODB_URI` 값을 Step 0.0.4 에서 메모해둔 **실제 URI** 로 교체. `USER` / `PASSWORD` / `CLUSTER` 자리에 진짜 값.

- [ ] **Step 3.3: `.env.local` 이 git 에 안 들어가는지 확인**

```bash
git status --short
```

Expected (예시):
```
?? .env.example
```
`?? .env.local` 이 보이면 안 됨. 이미 보이면 `.gitignore` 에 `.env*.local` + `.env` 가 있는지 다시 확인. (#4 에서 추가했음.)

`.env.local` 이 untracked 로도 안 보이는 게 정상 — gitignored 라.

- [ ] **Step 3.4: `.env.example` 만 commit**

```bash
git add .env.example
git commit -m "chore: add .env.example template for MONGODB_URI (#5)"
```

---

## Task 4: `GET /api/health` Route Handler

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 4.1: `app/api/health/route.ts` 작성**

```ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db().admin().ping();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[health] db ping failed:', error);
    return NextResponse.json(
      { ok: false, error: 'database connection failed' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4.2: 타입 검사 + lint + format**

```bash
npm run typecheck
npm run lint
npm run format
npm run format:check
```

Expected (각각):
- typecheck: 출력 없음 / exit 0
- lint: `✔ No ESLint warnings or errors`
- format: 변경된 파일 리스트 (route.ts 등)
- format:check: `All matched files use Prettier code style!`

- [ ] **Step 4.3: Commit**

```bash
git add app/api/health/route.ts
git commit -m "feat(api): add /api/health endpoint with db ping (#5)"
```

format 이 다른 파일도 손댔으면 그것도 같이 stage:
```bash
git status --short
git add -u   # 또는 구체적 파일 지정
git commit -m "style: apply Prettier formatting (#5)"
```

---

## Task 5: Smoke verification

코드 수정 없음. 모든 게 실제로 동작하는지 확인.

- [ ] **Step 5.1: dev 서버 실행**

```bash
npm run dev
```

Expected:
```
 ▲ Next.js 14.2.x
 - Local:        http://localhost:3000
 ✓ Ready in Xs
```

서버를 그대로 두고 새 터미널 또는 backgrounded curl 실행.

- [ ] **Step 5.2: Health endpoint curl**

새 터미널에서:
```bash
curl -s http://localhost:3000/api/health
```

Expected: `{"ok":true}`

처음 호출은 5 ~ 30초 걸릴 수 있음 (Atlas cold start + 첫 DB connect). 다시 호출하면 즉시 응답.

만약 `{"ok":false,...}` 가 나오면:
- dev 서버 콘솔 로그 확인: `[health] db ping failed: ...`
- 흔한 원인: (a) `MONGODB_URI` 패스워드 URL-encoding 누락, (b) Atlas IP allowlist 에 본인 IP 미등록, (c) DB user 권한 부족.
- 수정 후 dev 서버 자동 재시작 안 됨 — 환경변수 변경은 dev 서버 재시작 필요.

- [ ] **Step 5.3: dev 서버 종료**

`Ctrl+C`.

- [ ] **Step 5.4: 프로덕션 빌드**

```bash
npm run build
```

Expected (마지막 부분):
```
Route (app)                  Size     First Load JS
┌ ○ /                        ...
├ ○ /_not-found              ...
└ ƒ /api/health              ...

ƒ  (Dynamic)  server-rendered on demand
```

`ƒ` 표시는 `/api/health` 가 dynamic (server-rendered) 임을 의미 — DB 호출이 있어서 정적 prerender 안 됨. 정상.

- [ ] **Step 5.5: 최종 git 상태**

```bash
git status --short
```

Expected: 빈 출력 (모두 commit, `.env.local` 은 gitignored 라 보이지 않음).

---

## Task 6: Push + PR

- [ ] **Step 6.1: Push feature 브랜치**

```bash
git push -u origin feature/5-mongo-health
```

- [ ] **Step 6.2: PR 생성**

```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/5-mongo-health \
  --title "feat: MongoDB Atlas connection + /api/health endpoint (#5)" \
  --body "$(cat <<'EOF'
Closes #5.

## 변경
- `mongodb` driver 추가
- `lib/mongo.ts` — `MongoClient` 싱글톤 (dev hot reload 대비 `globalThis` 캐싱, prod 단순 connect)
- `app/api/health/route.ts` — `GET /api/health` → `client.db().admin().ping()` → `{ ok: true }` (실패 시 503 + `{ ok: false, error }`)
- `.env.example` — `MONGODB_URI` 템플릿 (committed)
- `.env.local` — 본인 머신 실제 값 (gitignored, commit 안 됨)

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm run build` 성공 (`/api/health` dynamic 라우트로 등록)
- [x] `curl localhost:3000/api/health` → `{"ok":true}` 확인

## 후속
- [#6 Task CRUD API](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/6) — `lib/mongo.ts` 위에서 `tasks` 컬렉션 CRUD 구현

## 참고
구현 계획: [\`docs/superpowers/plans/2026-06-05-issue-05-mongodb-health.md\`](docs/superpowers/plans/2026-06-05-issue-05-mongodb-health.md)
EOF
)"
```

- [ ] **Step 6.3: PR 확인 + 머지 + 로컬 정리**

PR URL 확인 후 셀프 리뷰 → 머지:
```bash
gh pr merge <PR번호> --repo boostcampwm-snu-2026-1/flowtodo-pkdje --squash
```

`Delete the branch locally? (y/N)` → `y`

머지 후:
```bash
git checkout main
git pull origin main
```

---

## Definition of Done

1. 이슈 [#5 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/5) 4개 다 충족:
   - `.env.local` 에 `MONGODB_URI` 정의 (Task 0.0.4 + 3.2) ✓
   - `lib/mongo.ts` 싱글톤 (Task 2) ✓
   - `GET /api/health` → `{ ok: true }` (Task 4) ✓
   - `.env.example` 커밋 (Task 3.4) ✓
2. typecheck / lint / format / build 다 통과 (Task 5).
3. PR 머지 후 main 에 반영.
4. 다음 이슈 [#6](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/6) 시작 가능 상태.

---

## After Merge (out of plan scope)

- 이슈 #5 자동 close (PR body `Closes #5` 통해).
- PR 시간 기록 (workflow 회고용).
- 다음 plan: [#6 Task CRUD API](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/6) — `lib/mongo.ts` 위에서 `tasks` 컬렉션 CRUD + 사이클 검증.
