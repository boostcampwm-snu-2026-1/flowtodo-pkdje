# Issue #19 — Vercel + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** GitHub OAuth 로그인을 추가해 task 를 사용자별로 격리하고, Vercel + Atlas 환경에서 배포 가능한 상태로 만든다.

**Architecture:** NextAuth.js v4 + GitHub provider + JWT session. lib/tasks 의 모든 함수가 첫 인자로 userId 를 받아 MongoDB 쿼리에 filter. middleware 가 `/` 보호, API route 는 직접 session 체크 후 401.

**Tech Stack:** next-auth 4.x · 기존 Next.js 14 + MongoDB

**Spec:** [docs/superpowers/specs/2026-06-13-issue-19-auth-vercel-design.md](../specs/2026-06-13-issue-19-auth-vercel-design.md)
**Branch:** `feature/19-auth-vercel`

---

## Task 0: 의존성 설치

```bash
npm install next-auth@^4
```

## Task 1: 타입 + lib/auth

- `types/next-auth.d.ts` — Session/JWT 타입 확장
- `lib/auth.ts` — `authOptions` + `getCurrentUserId()` 헬퍼

## Task 2: NextAuth 핸들러

- `app/api/auth/[...nextauth]/route.ts` — `GET`/`POST` export

## Task 3: lib/tasks userId 적용

- `TaskDoc` / `Task` 타입에 `userId: string` 추가
- `listTasks(userId)` / `createTask(userId, input)` / `updateTask(userId, id, patch)` / `deleteTask(userId, id)` 시그니처 변경
- `serializeTask` 가 `userId` 도 포함
- cascade detach 도 `userId` 필터에 묶음
- 내부 `hasCycle` / `validatePriority` 등은 그대로

## Task 4: lib/tasks.test 갱신

- 모든 호출에 dummy `'u1'` 추가
- 신규 3 케이스: userA listTasks 가 userB 의 것 안 보임 / userA 가 userB task update 시 not found / delete 동일

## Task 5: API route 갱신

- `app/api/tasks/route.ts` — `getCurrentUserId()` → 401 또는 호출
- `app/api/tasks/[id]/route.ts` — 동일

## Task 6: middleware

- `middleware.ts` — `withAuth` matcher `/`

## Task 7: AuthSessionProvider + layout

- `app/components/AuthSessionProvider.tsx` — `'use client'` 래퍼
- `app/layout.tsx` — `<AuthSessionProvider>` 로 감쌈 (server 유지)

## Task 8: Header 수정

- `useSession()` + 우상단 사용자 정보 + 로그아웃 버튼

## Task 9: .env.example + README

- 4개 변수 추가
- README 에 GitHub OAuth App 등록 + Vercel 배포 가이드

## Task 10: 검증

- `npx tsc --noEmit`
- `npx next lint`
- `npx vitest run` (46 케이스)
- `npx next build` (env 없이도 빌드는 통과해야)

## Task 11: Commit + Push + PR

- 큰 변경이라 3~4 commit 분리
- PR 본문에 OAuth App 등록 + Vercel 배포 가이드 + .env 변수 표
