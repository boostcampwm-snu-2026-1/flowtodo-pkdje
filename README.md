# flowtodo

선후관계가 있는 일을 DAG(방향 비순환 그래프)로 정리하고, 다음에 할 일을 자동으로 골라주는 개인용 todo 웹앱.

> Boostcamp WM SNU 2026 · 3주 개인 프로젝트 (박동제 / [@pkdje](https://github.com/pkdje))

**현재 상태**: Week 1 — 기획 단계 (구현 시작 전)

---

## 핵심 기능 (Week 2 ~ 3 구현 예정)

- **Task DAG** — 태스크 간 선후관계를 그래프로 명시. 한 태스크가 여러 선행 작업을 가질 수 있음.
- **시각화** — React Flow + dagre 자동 레이아웃. 노드 상태별 색상 + 의존성 엣지.
- **다음 작업 추천** — 우선순위(사용자 의도) + 다운스트림 임팩트(이 작업을 끝내면 몇 개의 후속 작업이 해금되는지) 가중합으로 점수화하여 좌측 패널에 정렬 표시.
- **사용자 오버라이드** — 추천 카드 핀(상단 고정) / snooze(큐에서 숨김) / 가중치 슬라이더.

자세한 기획: [Wiki — 프로젝트 기획서](../../wiki/01-project-plan)

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 14+ (App Router) |
| 언어 | TypeScript |
| DB | MongoDB (Atlas free tier), `mongodb` 드라이버 |
| 시각화 | React Flow + dagre |
| 상태관리 | Zustand |
| 스타일 | Tailwind CSS |
| 배포 | Vercel |

선택 이유: [Wiki — 프로젝트 기획서 §3](../../wiki/01-project-plan#3-기술-스택-및-선택-이유)

---

## 셋업 (구현 시작 후 채워질 예정)

```bash
# Week 2 부터 적용
git clone https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje.git
cd flowtodo-pkdje
npm install
cp .env.example .env.local   # MONGODB_URI 입력
npm run dev                  # http://localhost:3000
```

---

## 개발 관리

### 브랜치 모델 (트렁크 기반)
- `main` — 트렁크. 모든 PR 의 머지 대상이자 외부 가시 결과.
- `feature/<n>-<slug>` — 기능별 작업 브랜치. main 에서 분기 → PR 로 main 에 머지.
- `dev` 는 초기 베이스라인 sync 시점까지만 사용됨. 이후 PR 흐름에서는 빠짐 (필요 시 로컬 sandbox).

### Task / PR 흐름
1. GitHub Issue 에 task 등록 (Acceptance Criteria 포함, 1 ~ 2일 분량)
2. main 에서 `feature/<issue번호>-<짧은이름>` 브랜치 분기
3. 작업 후 PR (`feature → main`) 생성. 셀프 리뷰 + 머지.
4. main 이 항상 평가자/외부인이 보기에 일관된 결과 상태 유지됨.

> 솔로/3주 스코프에 dev 경유 2단계 PR 은 오버킬이라 트렁크 기반 채택. 부캠 자료의 "예) main → dev → features" 는 일반 예시로 해석.

### 문서
- 기획서 / 개발 워크플로우 / 회고 — [GitHub Wiki](../../wiki)
- 로컬 사본 (편집 후 위키 동기화): [`docs/planning/`](docs/planning)

---

## 진행 상황

| 주차 | 상태 | 산출물 |
|---|---|---|
| Week 1 | 진행 중 | [기획서](../../wiki/01-project-plan), [워크플로우](../../wiki/02-agent-workflow), [Task 백로그](docs/planning/03-task-backlog.md) |
| Week 2 | 예정 | 코어 구현 (CRUD, DAG 렌더, 추천 엔진) |
| Week 3 | 예정 | 다듬기 + 배포 |

배포 URL: _Week 3 에 추가 예정_

---

## 라이선스

본 저장소는 학습 목적의 개인 프로젝트이며 별도 라이선스 명시 없음.
