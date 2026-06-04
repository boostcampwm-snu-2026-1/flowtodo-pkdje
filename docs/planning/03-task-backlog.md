# Task 백로그 — GitHub Issue 초안

> 작성: 박동제 (pkdje) · 2026-05-30 · Week 1 산출물

본 문서는 GitHub Issue 로 등록할 초기 백로그다. 각 항목이 1 ~ 2일 분량의 PR 하나에 대응되도록 분해되어 있다. 진행하면서 추가/조정한다.

---

## Issue 템플릿

```markdown
## 개요
한 줄 요약 + 사용자/개발자 관점에서 무엇이 가능해지는가.

## Acceptance Criteria
- [ ] 명확하고 검증 가능한 조건 3 ~ 5개

## 의존
- 블로커: #X, #Y (선행 issue)

## 검증 방법
"됐다"를 어떻게 확인할 것인가. (브라우저 클릭 시나리오, curl, 유닛 테스트 등)

## 메모
스코프 경계, 결정 메모, 참조 문서 (예: `docs/planning/01-project-plan.md`).
```

---

## Week 1 — 준비 단계

### #1 저장소 구조 셋업 (README, 브랜치, gitignore)
- **개요**: 저장소를 협업/평가 가능한 형태로 셋업.
- **AC**:
  - [ ] README 에 프로젝트 소개, 스택, 셋업 절차, 브랜치 모델 표기
  - [ ] `.gitignore` 에 `.next/`, `node_modules/`, `.env*`, `.claude/settings.local.json` 포함
  - [ ] `main`, `dev` 브랜치 존재 및 `dev` 가 작업 브랜치
- **의존**: 없음
- **검증**: README 를 처음 보는 사람이 셋업 절차만 보고 따라 할 수 있는가
- **라벨**: `setup`, `week-1`

### #2 (Spike) React Flow + dagre 자동 레이아웃 검증
- **개요**: 가장 불확실한 부분(DAG 시각화 라이브러리 적합성) 을 작은 prototype 으로 검증.
- **AC**:
  - [ ] 10 ~ 20 개 mock 노드로 자동 레이아웃 시도
  - [ ] 화면 폭이 좁을 때, 의존성 깊이가 클 때 시각적 결과 확인
  - [ ] 한계 발견 시 대안(elkjs 등) 기록
- **의존**: #1
- **검증**: 스크린샷을 위키 회고에 첨부
- **라벨**: `spike`, `week-1`
- **메모**: 결과는 후속 issue 들 디자인에 반영. PR 안 만들고 별도 브랜치에서 실험 후 폐기 가능.

### #3 (선택) Wiki 페이지 게시 — 기획서/워크플로우
- **개요**: `docs/planning/01-project-plan.md`, `02-agent-workflow.md` 를 위키 페이지로 옮김.
- **AC**:
  - [ ] Wiki 사이드바에서 두 문서 접근 가능
  - [ ] 회고 페이지 골격 생성 (Week 1 회고 작성용 빈 페이지)
- **의존**: #1
- **검증**: 위키 URL 클릭해서 접근
- **라벨**: `docs`, `week-1`

---

## Week 2 — 코어 구현

### #4 Next.js 프로젝트 부트스트랩
- **개요**: Next.js App Router + TypeScript + Tailwind 스캐폴드.
- **AC**:
  - [ ] `next dev` 로 빈 메인 페이지 표시
  - [ ] Tailwind 적용 확인 (테스트 클래스로)
  - [ ] TypeScript strict 모드
  - [ ] ESLint + prettier 동작
- **의존**: #1
- **검증**: 메인 페이지 진입, 헤더 텍스트 보임
- **라벨**: `setup`, `week-2`

### #5 MongoDB 연결 + Health API
- **개요**: MongoDB Atlas 연결 + `/api/health` 엔드포인트로 연결 확인.
- **AC**:
  - [ ] `.env.local` 에 `MONGODB_URI` 정의 (예시는 `.env.example` 로 커밋)
  - [ ] `lib/mongo.ts` 싱글톤 커넥션
  - [ ] `GET /api/health` → DB ping 성공 시 `{ ok: true }`
- **의존**: #4
- **검증**: `curl localhost:3000/api/health` 결과 `{ ok: true }`
- **라벨**: `backend`, `week-2`

### #6 Task CRUD API
- **개요**: `tasks` 컬렉션 CRUD.
- **AC**:
  - [ ] `GET /api/tasks` — 모든 태스크 반환
  - [ ] `POST /api/tasks` — 생성 (title 필수, 기본 status='todo', priority=3)
  - [ ] `PATCH /api/tasks/:id` — title/description/status/priority/dueDate/prerequisites/**icon** 부분 수정
  - [ ] `DELETE /api/tasks/:id` — 삭제 (다른 태스크의 `prerequisites` 에서 해당 id 도 정리)
  - [ ] 서버 측 사이클 검증: `prerequisites` 수정 시 DFS 로 거부
  - [ ] **`icon?: string` 필드 수용 (이모지 1자, 검증 없음, 미지정 허용)** — [04-quest-game-ui §3](04-quest-game-ui.md#3-데이터-모델-변경)
- **의존**: #5
- **검증**: 각 엔드포인트 curl 시나리오 (생성 → 수정 → 삭제 → 사이클 시도 → 거부)
- **라벨**: `backend`, `week-2`

### #7 메인 페이지 레이아웃 (분할 뷰 골격)
- **개요**: 헤더 + 좌측 추천 패널 (placeholder) + 우측 그래프 캔버스 (placeholder).
- **AC**:
  - [ ] Tailwind 로 2단 분할 레이아웃
  - [ ] 헤더에 `+ 새 태스크`, `⚙ 설정` 버튼 (동작은 다음 issue)
  - [ ] 좌측 패널 폭 고정, 우측 캔버스 가변
- **의존**: #4
- **검증**: 데스크탑(1280px) 에서 깨지지 않는 레이아웃
- **라벨**: `frontend`, `week-2`

### #8 React Flow 기반 DAG 렌더 (read-only)
- **개요**: `/api/tasks` 데이터를 가져와 React Flow + dagre 로 그림. 편집 없음.
- **AC**:
  - [ ] mount 시 `/api/tasks` fetch → 노드/엣지 구성
  - [ ] dagre 로 자동 레이아웃 적용
  - [ ] 노드: 제목 표시 + 상태별 색
  - [ ] 줌/팬 동작
- **의존**: #6, #7, (#2 참고)
- **검증**: DB 에 mock 데이터 3 ~ 5개 넣고 화면에서 그래프 형태 확인
- **라벨**: `frontend`, `week-2`

### #9 태스크 생성 모달 (vertical slice)
- **개요**: `+ 새 태스크` 클릭 → 모달 → 제출 → 그래프에 노드 추가.
- **AC**:
  - [ ] 헤더 버튼 클릭 시 모달 열림
  - [ ] 제목 (필수), 우선순위 (1 ~ 5), 선행작업 다중 선택 입력
  - [ ] 제출 시 `POST /api/tasks` → 응답 후 클라이언트 state 갱신 → 새 노드 시각화 즉시 반영
- **의존**: #8
- **검증**: 모달에서 새 태스크 만들고 그래프에 등장하는 것까지 클릭 한 번으로 확인
- **라벨**: `frontend`, `week-2`

### #10 노드 클릭 → 편집 드로어
- **개요**: 그래프 노드 클릭 → 우측 드로어에서 모든 필드 편집.
- **AC**:
  - [ ] 노드 클릭 시 드로어 슬라이드 인
  - [ ] 제목/설명/우선순위/마감일/선행작업/상태 편집
  - [ ] 저장 시 `PATCH /api/tasks/:id` 호출 + 클라이언트 갱신
  - [ ] 삭제 버튼 (확인 후 `DELETE /api/tasks/:id`)
- **의존**: #9
- **검증**: 노드 클릭 → 제목 바꿈 → 저장 → 그래프 노드 라벨 갱신 확인
- **라벨**: `frontend`, `week-2`

### #11 의존성 엣지 생성/삭제 + 사이클 방지 (클라이언트)
- **개요**: 노드 끝에서 드래그로 엣지 생성, 엣지 클릭으로 삭제. 사이클이면 거부.
- **AC**:
  - [ ] React Flow connect handler 에서 사이클 검증 (DFS)
  - [ ] 사이클이면 빨갛게 깜빡 + 거부 메시지
  - [ ] 엣지 생성 성공 시 대상 노드의 `prerequisites` 에 source id 추가 (PATCH)
  - [ ] 엣지 클릭 → 삭제 확인 → PATCH 로 `prerequisites` 에서 제거
- **의존**: #10
- **검증**: A → B → A 시도 → 거부 / A → B 생성 → B 의 prerequisites 에 A 포함 확인
- **라벨**: `frontend`, `week-2`

### #12 상태 전환 (더블클릭 순환)
- **개요**: 노드 더블클릭 시 todo → in_progress → done → todo 순환. 색 갱신.
- **AC**:
  - [ ] 더블클릭 핸들러
  - [ ] PATCH 후 노드 색 갱신
  - [ ] done 으로 갈 때 후속 작업이 ready 로 바뀔 수 있음 (다음 issue 와 연결)
- **의존**: #10
- **검증**: 노드 더블클릭 3 회 → 색 순환
- **라벨**: `frontend`, `week-2`

### #13 추천 엔진 — Ready set + 점수 계산 (순수 로직 + 테스트)
- **개요**: 클라이언트 사이드 추천 계산 모듈. 테스트로 정확성 검증.
- **AC**:
  - [ ] `lib/recommender.ts` — `computeReadySet`, `computeImpact`, `computeScore`
  - [ ] 단일 DFS 메모화로 impact 계산 O(V+E)
  - [ ] 단위 테스트: 빈 그래프 / 선형 / 분기 / done 처리 / 사이클 입력 거부 등
- **의존**: 없음 (로직만)
- **검증**: `npm test` 통과
- **라벨**: `algorithm`, `week-2`
- **메모**: TDD 적용. 추천 알고리즘은 정확성이 핵심.

### #14 추천 패널 UI
- **개요**: 좌측 패널에 추천 카드 (점수순) 표시.
- **AC**:
  - [ ] `tasks` state 가 바뀔 때마다 추천 재계산
  - [ ] 카드 표시: 제목, 점수, 우선순위 별
  - [ ] 카드 클릭 시 React Flow 카메라가 해당 노드로 이동 + 강조
- **의존**: #8, #13
- **검증**: 우선순위 5 + 임팩트 큰 태스크가 1등인지 확인
- **라벨**: `frontend`, `week-2`

---

## Week 3 — 다듬기 + 배포

### #15 추천 핀 / Snooze
- **개요**: 추천 카드에 핀(상단 고정) / snooze(큐에서 숨김) 액션.
- **AC**:
  - [ ] 핀: 로컬 state 로 상단 고정, 새로고침 후에도 유지 (localStorage)
  - [ ] Snooze: 큐에서 숨김, DAG 에서는 보임. 24시간 후 자동 해제
- **의존**: #14
- **검증**: 핀 후 새로고침 → 여전히 상단 / snooze 후 큐에서 사라짐
- **라벨**: `frontend`, `week-3`

### ~~#16 노드 시각 다듬기~~ (취소 — #22 에 흡수)
- **상태**: 2026-06-02 결정으로 취소. ★/D-n/막힘 흐림은 모두 [#22 퀘스트 카드 노드](#22-퀘스트-카드-노드-신규) 안에서 같이 구현됨.
- **참고**: [04-quest-game-ui §6](04-quest-game-ui.md#6-스코프-변경)

### #21 lib/quest.ts + 단위 테스트 (신규)
- **개요**: 퀘스트 게임 UI 의 모든 파생 계산을 순수 함수로 구현.
- **AC**:
  - [ ] `connectedComponents(tasks)` — Union-Find or BFS
  - [ ] `questLineProgress(componentId, components, tasks)` — done/total
  - [ ] `rewardText(task, tasks)` — DAG 구조 → reward 문자열 (5가지 케이스)
  - [ ] `detectUnlocks(prev, next)` — 막힘 → ready 전환된 task id 들
  - [ ] 단위 테스트: 빈 그래프 / 선형 / 분기 / 다중 컴포넌트 / 사이드 퀘스트 / 라인 끝 노드 케이스
- **의존**: 없음 (순수 로직)
- **검증**: `npm test` 통과
- **라벨**: `algorithm`, `week-3`
- **메모**: TDD. 약 1일.

### #22 퀘스트 카드 노드 (신규)
- **개요**: React Flow Custom Node 로 퀘스트 카드 디자인 + 상태별 변형 + 해금 펄스 애니메이션.
- **AC**:
  - [ ] 카드 구조: 아이콘 + 우선순위 별 + 제목 + (마감일 D-n) + (score) + REWARD 라인
  - [ ] 상태 변형: `todo` 흰색 / `locked` 회색+🔒 LOCKED 배지 / `in_progress` 파랑 / `done` 초록+✓ CLEARED 배지
  - [ ] `detectUnlocks` 결과 노드에 0.9 초 펄스 애니메이션 (1 사이클만)
  - [ ] REWARD 텍스트는 `rewardText` 자동 생성 결과
  - [ ] ★/D-n/막힘 흐림 표시는 카드 안에 포함 (구 #16 흡수)
- **의존**: #8, #21
- **검증**: 5 ~ 10 개 mock 그래프에서 모든 상태가 시각적으로 구분되는지
- **라벨**: `frontend`, `polish`, `week-3`
- **메모**: 약 1.5일.

### #23 좌측 패널 리스킨 + 사이드 퀘스트 + 이모지 picker (신규)
- **개요**: 추천 패널을 퀘스트 톤으로 리스킨, SIDE QUESTS 섹션 추가, 새 태스크/편집에 이모지 picker.
- **AC**:
  - [ ] NEXT QUEST 카드 — 기존 추천 점수/별/핀/snooze 유지, 시각만 퀘스트 카드 톤
  - [ ] SIDE QUESTS 섹션 — 사이즈 1 컴포넌트들의 카드 리스트 (아이콘+제목, 짧은 가로 카드)
  - [ ] 진행 현황 박스 — 메인 퀘스트 X/Y · 사이드 X/Y
  - [ ] 새 태스크 모달에 이모지 picker (8 ~ 12 추천 + 기본 ⚡ + "다른 이모지")
  - [ ] 편집 드로어에 이모지 picker
  - [ ] prerequisite 비어있는 채로 저장 → 자동으로 사이드 퀘스트로 분류 (별도 토글 없음, 자연 분류)
- **의존**: #14, #21
- **검증**: 메인+사이드+이모지 변경 시나리오 클릭 한 번에 모두 동작
- **라벨**: `frontend`, `week-3`
- **메모**: 약 1일.

### #17 가중치 슬라이더 (priority vs impact)
- **개요**: 설정 모달에 `w_p` / `w_i` 슬라이더. 변경 시 추천 즉시 재계산.
- **AC**:
  - [ ] 0.0 ~ 1.0 슬라이더 (둘 합쳐 1.0 정규화)
  - [ ] localStorage 저장
  - [ ] 추천 패널 즉시 갱신
- **의존**: #14
- **검증**: 슬라이더를 priority 쪽 끝까지 → 우선순위 5 가 1등
- **라벨**: `frontend`, `week-3`

### #18 빈 상태 / 로딩 / 에러 UI
- **개요**: 태스크 0개일 때 안내, fetch 중 스켈레톤, API 실패 시 toast.
- **AC**:
  - [ ] 빈 상태: "첫 태스크를 만들어보세요" + 큰 + 버튼
  - [ ] 로딩 스켈레톤
  - [ ] 에러 toast (자동 사라짐)
- **의존**: #14
- **검증**: 빈 DB / 네트워크 끊기 시나리오
- **라벨**: `frontend`, `polish`, `week-3`

### #19 Vercel + MongoDB Atlas 배포
- **개요**: 배포 + 환경변수 설정 + README 에 배포 URL.
- **AC**:
  - [ ] Vercel 프로젝트 연결 (dev 브랜치 preview, main 브랜치 prod)
  - [ ] Atlas 무료 cluster + IP 허용
  - [ ] 환경변수 `MONGODB_URI` Vercel 에 등록
  - [ ] README 에 배포 URL
- **의존**: 모든 Week 2 완료
- **검증**: 배포 URL 에서 새 태스크 생성/조회 동작
- **라벨**: `devops`, `week-3`

### #20 회고 + 워크플로우 문서 업데이트
- **개요**: Week 1/2/3 회고 작성, 워크플로우 문서를 실제 경험으로 갱신.
- **AC**:
  - [ ] Wiki 에 주별 회고 페이지 (잘된 점, 안된 점, 배운 점, 다음에 바꿀 것)
  - [ ] `02-agent-workflow.md` 에 실제 효과 있었던 패턴 마킹
- **의존**: 해당 주 작업 종료
- **검증**: 회고 페이지 위키 게시
- **라벨**: `docs`, `week-1`, `week-2`, `week-3`

---

## Issue 간 의존성 (DAG)

```
#1 ─┬─ #2 (spike)
    ├─ #3 (wiki)
    └─ #4 ─ #5 ─ #6 ┐
            │       ├─ #8 ─┬─ #9 ─ #10 ┬─ #11
            │       │      │            └─ #12
            │       │      │
            │       │      └─ #22 (퀘스트 카드)
            │       │            
            └── #7 ─┘            
                    
            #13 ──────────────── #14 ┬─ #15
                                     ├─ #17
                                     ├─ #18 ─ #19
                                     └─ #23 (패널 리스킨 + 사이드)

            #21 (lib/quest.ts) ─┬─ #22
                                └─ #23
```

(주:
- #13, #21 은 다른 issue 와 거의 독립적이므로 어느 시점에든 병렬 진행 가능.
- 구 #16 노드 시각 polish 는 취소되어 #22 에 흡수됨.
- #22, #23 (퀘스트 UI) 는 Week 3 작업.)

---

## 메모 — 백로그 운영 원칙

- 새 기능 아이디어는 issue 로 등록 후 라벨 `backlog` + `consider-later`. 즉시 처리하지 않음.
- 1 ~ 2일 보다 큰 task 발견 시 sub-issue 로 분해.
- 매주 마지막에 백로그 재정렬, 다음 주 in-scope 선언.
- 의존성이 있는 issue 는 본문에 명시. `dev` 브랜치에 머지 순서가 의존 순서와 일치하도록.
