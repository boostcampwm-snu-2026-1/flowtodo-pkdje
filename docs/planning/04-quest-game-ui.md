# Quest Game UI Overlay — 설계 (Week 2 추가 결정)

> 작성: 박동제 (pkdje) · 2026-06-02 · Week 2 시작 시점에 추가된 결정

## 1. 동기

기존 [01-project-plan.md](01-project-plan.md) 의 DAG 시각화는 "노드 + 엣지 + 상태별 색" 의 깔끔한 todo 톤이었다. 사용자가 핵심 메커니즘(선행 작업 완료 → 후속 작업 해금)을 **게임 퀘스트 진행 느낌으로 재해석**하고 싶다고 결정함. 동시에 기존 모델이 다루지 않던 "선후관계가 없는 독립 태스크"의 분류도 명확히 한다.

이 문서는 그 결정을 구체화한다. 데이터 모델은 거의 그대로 두고, **시각/인터랙션 레이어를 퀘스트 톤으로 통일**한다.

## 2. 합의된 결정 (요약)

| 항목 | 결정 |
|---|---|
| 게이미피케이션 강도 | **C — 중간 (퀘스트 카드 톤)**. 카드 디자인 + 라벨(REWARD, LOCKED, CLEARED) + 해금 애니메이션 + QUEST LINE 진행률. |
| 독립 태스크 분류 | **B + D**. 좌측 패널 하단에 별도 "사이드 퀘스트" 섹션. 새 태스크 생성 시 prerequisite 비우면 자동 분류. |
| 퀘스트 라인 정의 | DAG 의 **연결 컴포넌트** = 1 퀘스트 라인. 크기 1 = 사이드 퀘스트. |
| REWARD 텍스트 | **DAG 구조에서 자동 생성** (직속 후속 노드 기반). 사용자 입력 없음. |
| 아이콘 | **선택 emoji 필드** (`icon?: string`). 기본 ⚡. 새 태스크/편집 시 picker. |
| 추천 패널 통합 | **A — 추천 패널을 "▶ NEXT QUEST" 로 리스킨**. 전체 UI 톤 통일. |
| 스코프 | **Week 3 안에 끼움**. #16(기존 노드 polish) 흡수 + 신규 #21–#23 추가. |

## 3. 데이터 모델 변경

```ts
type Task = {
  // ... 기존 필드 그대로
  icon?: string   // 추가. 이모지 1자. 미지정 시 렌더 시 ⚡ fallback.
}
```

- 다른 필드는 변동 없음.
- 모든 퀘스트 라인/REWARD 정보는 **저장하지 않고** DAG 구조에서 파생 계산.
- 마이그레이션 불필요 (기존 task 들은 icon 없이도 ⚡ 로 렌더).

## 4. 파생 계산 (`lib/quest.ts`)

모두 순수 함수. TDD 대상.

```ts
// 4.1 연결 컴포넌트 (Union-Find 또는 BFS)
function connectedComponents(tasks: Task[]): Component[]
// Component { id: string, taskIds: TaskId[] }
// 사이즈 1 = 사이드 퀘스트.

// 4.2 컴포넌트 진척도
function questLineProgress(componentId, components, tasks): { done: number, total: number }

// 4.3 REWARD 텍스트 자동 생성
function rewardText(task: Task, tasks: Task[]): string
// 규칙:
//   직속 후속 1개   → "{이름} 해금"
//   직속 후속 2~3개 → "{이름1}, {이름2} 해금"
//   직속 후속 4개+ → "{N}개 작업 해금"
//   후속 없음 + 컴포넌트 크기 > 1 → "메인 퀘스트 X/Y 완료"
//   후속 없음 + 컴포넌트 크기 == 1 → "사이드 퀘스트 완료"

// 4.4 해금 감지 (애니메이션 트리거)
function detectUnlocks(prev: Task[], next: Task[]): TaskId[]
// 이전에 막힘(prereq 미완), 지금은 ready 인 task 들.
// 다음 렌더 사이클에서 0.9초 펄스 애니메이션.
```

복잡도: 모두 O(V+E). 수백 노드 기준 즉시 끝남.

## 5. UI 변경

### 5.1 DAG 캔버스 — 퀘스트 카드 노드

React Flow 의 [Custom Node](https://reactflow.dev/docs/api/nodes/custom-nodes/) 로 구현. 기존 단순 박스 노드 교체.

```
┌─────────────────────────┐
│ 🎨 priority ★★★★★      │  아이콘 + 우선순위
│ 디자인                   │  제목 (굵게)
│ D-3 · score 7.4          │  마감 + (추천 후보일 때) 점수
│ ─────────────────       │
│ ▷ REWARD                │
│ 프론트, 백엔드 해금        │  자동 생성
└─────────────────────────┘
```

상태별 변형:

| 상태 | 시각 |
|---|---|
| `todo` (ready) | 흰 배경, 기본 테두리 |
| `todo` (locked — prereq 미완) | 회색 배경, opacity 0.6, 좌상단 `🔒 LOCKED` 배지 |
| `in_progress` | 파란 톤 |
| `done` | 초록 톤, 우상단 `✓ CLEARED` 배지 |
| just unlocked (1 사이클) | 0.9 초 scale+rotate+노란 강조 펄스 |

### 5.2 좌측 패널 — "퀘스트 로그"

기존 추천 패널을 NEXT QUEST 로 리스킨. 그 아래 SIDE QUESTS 섹션 추가. 맨 아래 진행 현황.

```
┌────────────────────────┐
│ ▶ NEXT QUEST (Top 3)   │
│ ┌──────────────────┐   │
│ │ 🎨 디자인 score 8.2│   │  ← 카드 톤 통일
│ │ ★★★★★            │   │
│ │ ▷ 프론트, 통합 해금 │   │
│ └──────────────────┘   │
│ ...                    │
│                        │
│ ⚡ SIDE QUESTS (5)     │  ← 신규
│ ┌──────────────────┐   │
│ │ ⚡ 우유 사기      │   │  ← 단일 노드 컴포넌트
│ └──────────────────┘   │
│ ...                    │
│                        │
│ ─ 진행 현황 ─           │
│ 메인 퀘스트 4/12       │
│ 사이드 2/5             │
└────────────────────────┘
```

NEXT QUEST 카드:
- 기존 추천 점수 + 별 + 핀/snooze 액션 (#15) 그대로 유지
- 시각만 퀘스트 카드 톤
- 클릭 → React Flow 캔버스에서 해당 노드로 카메라 이동 + 강조

SIDE QUESTS 카드:
- icon + 제목만 (점수/별 표시 안 함, 짧은 가로 카드)
- 클릭 → 캔버스에서 해당 노드 강조

진행 현황 박스:
- 메인 퀘스트: 사이즈 ≥ 2 인 모든 컴포넌트의 done/total 합산
- 사이드: 사이즈 == 1 인 컴포넌트의 done/total 합산

### 5.3 모달 / 드로어

- **새 태스크 모달**: 제목 입력 위에 이모지 picker 1줄. 추천 8 ~ 12 개 (`⚡ 🎨 💻 🔬 📝 🏃 🎯 🛠 🎁 📞 🍴 🛒`) + "다른 이모지" 입력. 기본 ⚡.
- **편집 드로어**: 같은 picker 추가.
- **prerequisite 비어있는 상태로 저장** → 자동으로 사이드 퀘스트 분류 (별도 토글 없음).

### 5.4 기존 인터랙션 보존
- 노드 클릭 → 편집 드로어
- 노드 더블클릭 → 상태 순환
- 노드 끝 드래그 → 의존성 엣지 생성

## 6. 스코프 변경

### Week 2 — 최소 영향
- **#6 Task CRUD API**: `icon?: string` 필드 추가 (수용/저장만, 검증 불필요).

### Week 3 — 6 → 8 이슈

| 이슈 | 변경 |
|---|---|
| #15 추천 핀 / Snooze | 그대로 |
| ~~#16 노드 시각 다듬기~~ | **삭제, #22 에 흡수** |
| #17 가중치 슬라이더 | 그대로 |
| #18 빈/로딩/에러 UI | 그대로 |
| #19 배포 | 그대로 |
| #20 회고 + 워크플로우 doc | 그대로 |
| **#21 lib/quest.ts + 단위 테스트** (신규) | 파생 함수 4개. TDD. ≈ 1일. |
| **#22 퀘스트 카드 노드 (React Flow custom node)** (신규) | 카드 디자인 + 상태별 변형 + 해금 펄스 애니메이션. ★/D-n/막힘 흐림 흡수. ≈ 1.5일. |
| **#23 좌측 패널 리스킨 + 사이드 퀘스트 + 이모지 picker** (신규) | NEXT QUEST 리스킨, SIDE QUESTS 섹션, 진행 현황, 모달/드로어 picker. ≈ 1일. |

**합계**: +2 ~ 2.5일.

### 의존성

```
#21 (lib/quest.ts) ─┬─ #22 (카드 노드 — REWARD 등 소비)
                    └─ #23 (사이드 퀘스트 분류 — connectedComponents 소비)

#22 ←─ #8 (기존 DAG 렌더) 의 확장
#23 ←─ #14 (기존 추천 패널) 의 확장
```

## 7. 위험

| 위험 | 대응 |
|---|---|
| Week 3 빡빡함 (+2 ~ 2.5일) | Week 2 가 1일이라도 밀리면 #15(핀/snooze) 또는 #17(가중치 슬라이더) 를 Week 4 후 추가 작업으로 미룸. |
| 퀘스트 카드 톤이 큰 그래프에서 시각 노이즈 | 스파이크 [#2 (React Flow + dagre)](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/2) 에서 카드 톤 mock 으로 검증. 50+ 노드에서 견디는지. |
| 해금 펄스 애니메이션이 매 클릭마다 발동되어 산만 | `detectUnlocks` 가 **상태가 just-transitioned** 인 경우만 반환. 일반 리렌더에는 트리거 안 됨. |
| REWARD 텍스트가 후속 이름 길면 카드 깨짐 | 2 ~ 3개 이름 직접 노출 후 그 이상은 "{N}개 해금" 으로 축약. |
| 이모지 picker 가 모바일 키보드 UX 와 충돌 | 1주차에 모바일 반응형은 스코프 외. 데스크탑 기준만. |

## 8. Implementation Hints (Spike #2 결과 반영)

[Spike #2 (React Flow + dagre)](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/2) 에서 검증된 구체 설정값. #8 (DAG 렌더), #22 (퀘스트 카드 노드) 구현 시 시작점으로 사용. 전체 findings: `spike/SPIKE.md` ([브랜치](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/tree/spike/react-flow-dagre/spike)).

### 8.1 dagre 자동 레이아웃 설정

```ts
const dagreConfig = {
  rankdir: 'TB',           // Top → Bottom (LR 도 옵션)
  nodesep: 12,             // 가로 간격. 기본 30 너무 spacious
  ranksep: 28,             // 세로 간격. 기본 60 너무 spacious
  ranker: 'tight-tree',    // 'network-simplex' 보다 컴팩트
  marginx: 16,
  marginy: 16,
};
```

이 값에서 50 ~ 80 노드 그래프가 시각적으로 견딤. 더 spacious 가 필요해지면 사용자 설정으로 노출 가능 (3주 스코프 외).

### 8.2 퀘스트 카드 dagre 노드 크기

dagre 에 전달할 노드 박스 사이즈 (실제 렌더 카드 사이즈와 일치):

```ts
g.setNode(taskId, { width: 150, height: 76 });
```

폰트: 본문 11px / 메타·REWARD 9px. 패딩 6/10 px. (자세한 카드 디자인은 §5.1.)

### 8.3 React Flow fitView 설정

```ts
<ReactFlow
  fitView
  fitViewOptions={{
    padding: 0.08,
    minZoom: 0.6,   // 글자 가독성 한계
    maxZoom: 1.5,
  }}
  minZoom={0.1}      // 사용자 줌 아웃 한계
  maxZoom={2}
/>
```

`fitViewOptions.minZoom: 0.6` 이 중요. 이 값 없이 fitView 사용하면 노드 수가 늘어날수록 글자 안 보일 정도로 축소됨.

### 8.4 MiniMap 가시성

```tsx
<MiniMap
  pannable          // 미니맵 드래그로 메인 뷰포트 이동
  zoomable          // 스크롤로 줌
  nodeStrokeColor="#37474f"
  nodeStrokeWidth={1}
  maskColor="rgba(15,23,42,0.55)"
  style={{
    backgroundColor: '#fff',
    border: '2px solid #455a64',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  }}
  nodeColor={(n) =>
    n.data?.status === 'done' ? '#a5d6a7'
      : n.id === selectedId ? '#ff6f00'
      : '#90a4ae'
  }
/>
```

`pannable + zoomable` 로 미니맵이 단순 표시에서 인터랙티브 컨트롤로 격상. 테두리/그림자/흰배경 으로 메인 화면과 명확히 분리.

### 8.5 노드 클릭 → 연결 엣지/노드 강조 (인지 부하 해소)

엣지 교차는 DAG 구조에서 오는 inherent 특성이라 알고리즘으로 완전히 없앨 수 없음. 대신 "지금 보고 싶은 엣지만" 분리해서 보는 UX 로 해소:

```ts
const [selectedId, setSelectedId] = useState<string | null>(null);

// onNodeClick → setSelectedId(node.id)
// onPaneClick → setSelectedId(null)

const connectedIds = useMemo(() => {
  if (!selectedId) return null;
  const s = new Set([selectedId]);
  edges.forEach(e => {
    if (e.source === selectedId) s.add(e.target);
    if (e.target === selectedId) s.add(e.source);
  });
  return s;
}, [selectedId, edges]);

// 노드: 비연결은 opacity 0.18
// 연결 엣지: 주황(#ff6f00) + strokeWidth 2.5 + animated
// 비연결 엣지: 회색 + opacity 0.3
```

이 인터랙션은 **#22 안에 포함** (퀘스트 카드 노드의 자연스러운 일부로 구현).

### 8.6 성능 측정 (스파이크)

| 노드 수 | layout 시간 (Mac M-series) |
|---|---|
| 50 | < 5 ms |
| 80 | < 10 ms |
| 120 | < 25 ms |

3주 스코프(수십 ~ 100 노드)에서 충분. 200+ 노드 측정은 Week 3 회고에서.

### 8.7 검증 안 된 항목 (구현 중 확인)

- 실제 CRUD 와 결합한 인터랙션 성능 (정적 렌더만 측정)
- 사이클 시도 시 거부 피드백 UX
- 노드 추가/삭제 시 자동 레이아웃 재계산의 시각적 부드러움 (즉시 vs 트랜지션)
- 모바일 (스코프 외)
- 다크 모드 (스코프 외)

---

## 9. 회고에서 확인할 것

- 게이미피케이션 톤이 실제 사용에서 **재미** 인가 **노이즈** 인가? (본인 사용 후 평가)
- 사이드 퀘스트 자동 분류가 직관적이었는가? 별도 토글이 필요한가?
- 해금 애니메이션의 빈도/길이가 적절했는가?
- Week 3 시간 예산 대비 +2.5일이 실제로 얼마였는가?
