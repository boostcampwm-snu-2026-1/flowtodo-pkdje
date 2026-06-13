export { default } from 'next-auth/middleware';

// `/` 만 보호. API 라우트는 각 핸들러에서 직접 401 처리한다
// (middleware 가 redirect 하면 fetch 측에서 어색).
// `/api/auth/*` 와 `/api/health` 는 공개.
export const config = {
  matcher: ['/'],
};
