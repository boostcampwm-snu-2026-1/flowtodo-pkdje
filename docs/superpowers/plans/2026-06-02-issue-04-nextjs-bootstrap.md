# Issue #4 — Next.js 부트스트랩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js 14 (App Router) + TypeScript strict + Tailwind + ESLint + Prettier project in the existing repo, so subsequent issues (#5 MongoDB 연결, #6 CRUD API, ...) have a working dev environment to build on.

**Architecture:** App Router with strict TypeScript. Tailwind for styling. ESLint (next/core-web-vitals) + Prettier (with Tailwind class sorting) for code quality. Manual scaffold (not `create-next-app`) because the directory already contains README, docs/, spike/, .git — manual gives clean control over what gets created and avoids fighting the CLI.

**Tech Stack:** Next.js 14.2 · React 18.3 · TypeScript 5.5 · Tailwind CSS 3.4 · ESLint 8.57 · Prettier 3.3

**Issue:** [#4 Next.js 프로젝트 부트스트랩](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/4)
**Branch model:** `feature/4-nextjs-bootstrap → main` (트렁크 기반, dev 경유 없음)

---

## File Structure

| File | Purpose |
|---|---|
| `package.json` | Deps + npm scripts (dev/build/lint/format/typecheck) |
| `package-lock.json` | npm lock |
| `tsconfig.json` | TypeScript strict + Next.js paths |
| `next.config.mjs` | Next.js config (minimal) |
| `tailwind.config.ts` | Tailwind content paths + theme |
| `postcss.config.mjs` | PostCSS plugins (tailwindcss, autoprefixer) |
| `.eslintrc.json` | next/core-web-vitals |
| `.prettierrc` | Prettier config + Tailwind plugin |
| `.prettierignore` | Skip dirs/files |
| `.gitignore` | Append `.next/`, `.env*`, `next-env.d.ts` |
| `app/layout.tsx` | Root layout (lang="ko", body wraps children) |
| `app/page.tsx` | Home page placeholder (헤더 텍스트 + Tailwind 테스트 클래스) |
| `app/globals.css` | Tailwind directives + minimal base styles |

**Not creating** (will come in later issues):
- `lib/mongo.ts` (#5)
- `app/api/*` (#5, #6)
- `lib/quest.ts` (#21)
- React Flow components (#8 +)

---

## Task 0: Feature Branch

- [ ] **Step 0.1: Switch to main and pull latest**

Run:
```bash
git checkout main
git pull origin main
git status --short
```

Expected:
- `main` 이 현재 브랜치
- 베이스라인 머지 commit 까지 받아옴
- status 빈 줄 (clean)

- [ ] **Step 0.2: Create feature branch from main**

Run:
```bash
git checkout -b feature/4-nextjs-bootstrap
```

Expected:
```
Switched to a new branch 'feature/4-nextjs-bootstrap'
```

---

## Task 1: package.json + dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1.1: Create `package.json`**

```json
{
  "name": "flowtodo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "next": "^14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.18",
    "postcss": "^8.4.39",
    "prettier": "^3.3.2",
    "prettier-plugin-tailwindcss": "^0.6.5",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3"
  }
}
```

- [ ] **Step 1.2: Install dependencies**

Run:
```bash
npm install
```

Expected: `added N packages, and audited N+1 packages in Xs` (no errors). May print a few peer dep warnings — OK.

- [ ] **Step 1.3: Verify install**

Run:
```bash
ls -d node_modules/next node_modules/react node_modules/typescript node_modules/tailwindcss
```

Expected: all four directories listed.

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Next.js 14 + TS + Tailwind dependencies (#4)"
```

---

## Task 2: TypeScript strict config

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 2.1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules", "spike"]
}
```

`spike` excluded because the spike folder has CDN-imported JS that isn't part of the build.

- [ ] **Step 2.2: Verify typecheck (no files yet, should still succeed)**

Run:
```bash
npx tsc --noEmit
```

Expected: no output, exit code 0. (No TS files exist yet, so nothing to check.)

- [ ] **Step 2.3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add TypeScript strict config (#4)"
```

---

## Task 3: Next.js scaffold (App Router)

**Files:**
- Create: `next.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Modify: `.gitignore` (append `.next/`, `.env*`, `next-env.d.ts`)

- [ ] **Step 3.1: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 3.2: Create `app/globals.css` (empty for now, Tailwind directives added in Task 4)**

```css
/* Tailwind directives added in Task 4 */
```

- [ ] **Step 3.3: Create `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'flowtodo',
  description: 'DAG-based todo with quest-style next-action recommendations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3.4: Create `app/page.tsx` (placeholder home)**

```tsx
export default function Home() {
  return (
    <main>
      <h1>flowtodo</h1>
      <p>Bootstrapped. Replace me with the real dashboard in #7.</p>
    </main>
  );
}
```

- [ ] **Step 3.5: Append Next.js entries to `.gitignore`**

Add these lines to the end of `.gitignore`:

```
# Next.js
.next/
out/
next-env.d.ts

# env
.env*.local
.env
```

Final `.gitignore` should look like:

```
.superpowers/
node_modules/
.DS_Store
.claude/settings.local.json

# Next.js
.next/
out/
next-env.d.ts

# env
.env*.local
.env
```

- [ ] **Step 3.6: Start dev server and verify**

Run (in background or new terminal):
```bash
npm run dev
```

Expected output includes:
```
   ▲ Next.js 14.2.x
   - Local:        http://localhost:3000
 ✓ Ready in Xs
```

Open http://localhost:3000 in browser. Expected: page shows "flowtodo" heading and the placeholder paragraph.

- [ ] **Step 3.7: Stop dev server**

`Ctrl+C` in the dev server terminal.

- [ ] **Step 3.8: Commit**

```bash
git add next.config.mjs app/layout.tsx app/page.tsx app/globals.css .gitignore
git commit -m "feat: scaffold Next.js App Router with placeholder home (#4)"
```

---

## Task 4: Tailwind CSS

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 4.1: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4.2: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4.3: Replace `app/globals.css` content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4.4: Update `app/page.tsx` with Tailwind test classes**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-slate-900">flowtodo</h1>
      <p className="mt-2 text-slate-600">
        Bootstrapped. Replace me with the real dashboard in #7.
      </p>
    </main>
  );
}
```

- [ ] **Step 4.5: Verify Tailwind applies**

Run:
```bash
npm run dev
```

Open http://localhost:3000. Expected:
- Heading "flowtodo" is large, bold, dark slate color
- Padding around content (32px on all sides)
- Paragraph is muted slate

If the page looks unstyled (default browser fonts/sizes), Tailwind didn't apply. Common causes:
- `content` path in `tailwind.config.ts` doesn't match
- `@tailwind` directives missing from `globals.css`
- `globals.css` not imported in `layout.tsx`

Stop dev server (`Ctrl+C`).

- [ ] **Step 4.6: Commit**

```bash
git add tailwind.config.ts postcss.config.mjs app/globals.css app/page.tsx
git commit -m "feat: integrate Tailwind CSS (#4)"
```

---

## Task 5: ESLint

**Files:**
- Create: `.eslintrc.json`

- [ ] **Step 5.1: Create `.eslintrc.json`**

```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@next/next/no-html-link-for-pages": "off"
  }
}
```

- [ ] **Step 5.2: Run lint**

Run:
```bash
npm run lint
```

If asked to choose ESLint config (first run of `next lint`), respond `Strict` (most common default).

Expected output:
```
✔ No ESLint warnings or errors
```

If errors appear, fix them in the relevant files (most likely formatting issues in `app/page.tsx`).

- [ ] **Step 5.3: Commit**

```bash
git add .eslintrc.json
git commit -m "chore: configure ESLint with next/core-web-vitals (#4)"
```

---

## Task 6: Prettier (with Tailwind class sorting)

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 6.1: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 6.2: Create `.prettierignore`**

```
.next/
node_modules/
out/
package-lock.json
spike/
.superpowers/
docs/superpowers/
```

`docs/superpowers/` excluded because skill-generated docs aren't application code and Prettier formatting on long markdown is noisy.

- [ ] **Step 6.3: Run format check**

Run:
```bash
npm run format:check
```

Expected: list of files that would be reformatted. Likely all of `app/*.tsx`, config files, etc. — they were hand-authored with sensible defaults but may not match Prettier exactly.

- [ ] **Step 6.4: Apply formatting**

Run:
```bash
npm run format
```

Expected: list of files reformatted. The Tailwind plugin will also sort class names in `app/page.tsx` (e.g., `text-slate-900 font-bold text-3xl` → `text-3xl font-bold text-slate-900`).

- [ ] **Step 6.5: Verify format is clean**

Run:
```bash
npm run format:check
```

Expected:
```
Checking formatting...
All matched files use Prettier code style!
```

- [ ] **Step 6.6: Commit**

```bash
git add .prettierrc .prettierignore app/ tailwind.config.ts postcss.config.mjs next.config.mjs tsconfig.json .eslintrc.json package.json
git commit -m "chore: configure Prettier + Tailwind class sorting, apply formatting (#4)"
```

---

## Task 7: Smoke verification + production build

No new files — verify everything works end-to-end before opening PR.

- [ ] **Step 7.1: TypeScript check**

Run:
```bash
npm run typecheck
```

Expected: no output, exit code 0.

- [ ] **Step 7.2: Lint**

Run:
```bash
npm run lint
```

Expected: `No ESLint warnings or errors`.

- [ ] **Step 7.3: Format check**

Run:
```bash
npm run format:check
```

Expected: `All matched files use Prettier code style!`.

- [ ] **Step 7.4: Production build**

Run:
```bash
npm run build
```

Expected:
```
   ▲ Next.js 14.2.x

   Creating an optimized production build ...
 ✓ Compiled successfully
 ...
Route (app)                  Size     First Load JS
┌ ○ /                        ...
└ ○ /_not-found              ...

○ (Static)  prerendered as static content
```

Exit code 0.

- [ ] **Step 7.5: Manual smoke test in browser**

Run:
```bash
npm run dev
```

Open http://localhost:3000. Confirm:
- [ ] Page loads without console errors (open DevTools Console)
- [ ] "flowtodo" heading visible, styled with Tailwind (large, bold)
- [ ] Tailwind reset applied (no default browser margins on `<body>`)
- [ ] Paragraph below heading visible

Stop dev server with `Ctrl+C`.

- [ ] **Step 7.6: Verify clean git state**

Run:
```bash
git status --short
```

Expected: empty output (all committed).

---

## Task 8: Push branch and open PR

- [ ] **Step 8.1: Push feature branch**

Run:
```bash
git push -u origin feature/4-nextjs-bootstrap
```

- [ ] **Step 8.2: Open PR**

Run:
```bash
gh pr create --repo boostcampwm-snu-2026-1/flowtodo-pkdje \
  --base main --head feature/4-nextjs-bootstrap \
  --title "feat: scaffold Next.js 14 + TS + Tailwind + ESLint + Prettier (#4)" \
  --body "$(cat <<'EOF'
Closes #4.

## 변경
- Next.js 14.2 App Router 스캐폴드 (`app/layout.tsx`, `app/page.tsx`)
- TypeScript strict mode + paths alias `@/*`
- Tailwind CSS 3.4 + autoprefixer + PostCSS
- ESLint (next/core-web-vitals)
- Prettier + `prettier-plugin-tailwindcss` (클래스 자동 정렬)
- `.gitignore` 에 `.next/`, `.env*`, `next-env.d.ts` 추가

## 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [x] `npm run format:check` 통과
- [x] `npm run build` 성공
- [x] `npm run dev` → http://localhost:3000 에서 "flowtodo" 헤더 + Tailwind 스타일 적용 확인

## 의존성
없음 (issue #1 저장소 셋업 후 첫 코드 PR).

## 후속
#5 MongoDB 연결, #7 메인 페이지 레이아웃 (분할 뷰 골격).
EOF
)"
```

- [ ] **Step 8.3: Verify PR**

Output of `gh pr create` will print the PR URL. Open it and verify:
- Base branch: `dev`
- Head branch: `feature/4-nextjs-bootstrap`
- Title shows "(#4)"
- Body renders correctly
- "Closes #4" linkbacks the issue

---

## Definition of Done

This plan is complete when all of the following hold:

1. All issue [#4 AC](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/4) checked off:
   - `next dev` 로 빈 메인 페이지 표시 ✓ (Task 3.6, 4.5, 7.5)
   - Tailwind 적용 확인 (테스트 클래스로) ✓ (Task 4.5)
   - TypeScript strict 모드 ✓ (Task 2.1 + 7.1)
   - ESLint + prettier 동작 ✓ (Task 5, 6, 7.2, 7.3)
2. Production build succeeds (Task 7.4).
3. Clean git state (Task 7.6).
4. PR open against `dev` (Task 8).
5. Time spent recorded in workflow notes (per Week 1 retrospective commitment to "PR 사이즈 실측").

---

## After Merge (out of plan scope)

- Close issue #4 (`Closes #4` in PR body should auto-close on merge).
- Update workflow doc with actual PR duration vs estimated 1 ~ 2일.
- Start [#5 MongoDB 연결 + Health API](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/5).
