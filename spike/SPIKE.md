# Spike: React Flow + dagre — 적합성 검증

> 박동제 · 2026-06-02 · GitHub [Issue #2](https://github.com/boostcampwm-snu-2026-1/flowtodo-pkdje/issues/2)
> 브랜치: `spike/react-flow-dagre` · 산출물: 본 문서 + `index.html` (폐기 가능)

## 목적

[01-project-plan.md](../docs/planning/01-project-plan.md) 와 [04-quest-game-ui.md](../docs/planning/04-quest-game-ui.md) 에서 결정한 **React Flow + dagre** 조합이 우리 사용 조건(노드 50 ~ 80, 퀘스트 카드 톤)에서 시각적으로 견디는지 검증한다.

## 실험 셋업

- 단일 HTML 파일 (`spike/index.html`), 설치 없이 esm.sh CDN 으로 React 18 + React Flow 11 + dagre 0.8 로드
- 4가지 그래프 모양 mock 생성: Balanced(분기) / Deep(긴 체인) / Wide(얕고 넓음) / Mixed(혼합)
- 4가지 크기: 20 / 50 / 80 / 120
- 2가지 방향: TB / LR
- 2가지 노드 톤: 기본 박스 / 퀘스트 카드
- 3가지 컴팩트 프리셋 (dagre 파라미터 그룹)

## 발견 — 첫 라운드 (dagre 기본값)

| 항목 | 결과 |
|---|---|
| 시각 결과 | **불합격**. 노드가 너무 넓게 퍼져서 fitView 가 0.05 이하로 축소 → 글자 안 보임 |
| 미니맵 | 메인 화면에 묻혀 가시성 낮음 |
| 엣지 교차 | DAG 구조 자체로 인한 inherent 교차 |
| 인터랙션 | 노드 클릭 시 어떤 게 어디 연결됐는지 추적 어려움 |

dagre 기본값 (`nodesep: 50, ranksep: 50, ranker: 'network-simplex'`) + 우리 퀘스트 카드(180px) 조합이 너무 spacious.

## 튜닝

### dagre 설정
```js
const dagreConfig = {
  rankdir: 'TB',
  nodesep: 12,           // 30 → 12 (가로 간격)
  ranksep: 28,           // 60 → 28 (세로 간격)
  ranker: 'tight-tree',  // 더 컴팩트한 ranking
  marginx: 16,
  marginy: 16,
};
```

### 노드 크기
- 퀘스트 카드: **150 × 76 px** (180 × 90 에서 축소)
- 폰트: 본문 11px / 메타 9px
- 패딩: 6/10 px

### React Flow fitView
```js
const fitViewOptions = {
  padding: 0.08,
  minZoom: 0.6,   // fitView 가 0.6 이하로 못 줄이게 (글자 가독성)
  maxZoom: 1.5,
};
```

### MiniMap 스타일링
```js
<MiniMap
  pannable           // 미니맵 드래그로 메인 뷰포트 이동
  zoomable           // 스크롤로 줌
  nodeStrokeWidth={1}
  style={{
    backgroundColor: '#fff',
    border: '2px solid #455a64',
    borderRadius: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  }}
/>
```

### 인터랙션 — 클릭 시 강조
```js
const [selectedId, setSelectedId] = useState(null);
// onNodeClick → setSelectedId(node.id)
// onPaneClick → setSelectedId(null)

// 선택된 노드의 직접 연결 노드/엣지를 계산
const connectedIds = new Set([selectedId, ...edges에서 source/target 추출]);

// 비연결 노드: opacity 0.18
// 연결 엣지: 주황(#ff6f00) + 굵게 2.5px + animated
// 비연결 엣지: opacity 0.3
```

## 발견 — 두 번째 라운드 (튜닝 후)

| 항목 | 결과 |
|---|---|
| 50 + Balanced + Tight + Quest | **합격**. 글자 읽힘, 카드 간 거리 적절 |
| 80 + Balanced + Tight + Quest | **합격**. 약간 빡빡하지만 견딤 |
| 120 + Mixed + Tight | **합격 (극단)**. 카드 톤 무거워지지만 fitView 가 적절히 잡아줌, 노드 클릭 강조로 인지 부하 해소 |
| Wide + Tight | **합격**. 한 레이어 노드 많아도 가로로 자연스럽게 펼침 |
| Deep + LR | **합격**. 긴 체인은 LR 이 가장 자연스러움 |
| 미니맵 가시성 | 테두리 + 그림자 + 흰 배경으로 명확히 분리 |
| 엣지 교차 | 인지 부하는 클릭 시 강조 UX 로 해소. 그래프 구조 자체로 인한 inherent 교차는 라이브러리 한계가 아님 |

## 성능

| 노드 수 | 레이아웃 시간 (Mac M-series) |
|---|---|
| 50 | < 5 ms |
| 80 | < 10 ms |
| 120 | < 25 ms |

200 노드 이상도 무리 없을 듯. 추후 측정 필요 (Week 3 회고).

## 결론

**React Flow + dagre 조합으로 진행 OK.** 단, 다음 설정값을 [04-quest-game-ui.md](../docs/planning/04-quest-game-ui.md) 에 반영:

1. dagre 파라미터: `nodesep: 12 / ranksep: 28 / ranker: 'tight-tree'`
2. 퀘스트 카드: 150 × 76 px (180 → 축소)
3. fitView: `padding: 0.08 / minZoom: 0.6 / maxZoom: 1.5`
4. MiniMap: `pannable + zoomable + 테두리 + 그림자` (가시성 확보)
5. 노드 클릭 시 연결 엣지/노드 강조 (인지 부하 해소). 이건 #22 또는 별도 polish issue 로.

## 검증 안 한 것 (Week 2/3 에서 직접 확인)

- 실제 CRUD 인터랙션과 결합한 성능 (지금은 정적 렌더만 측정)
- 사이클 시도 시 사용자 피드백 (빨갛게 깜빡 / 거부 메시지)
- 노드 추가/삭제 시 자동 레이아웃 재계산의 부드러움 (애니메이션 전환?)
- 모바일 (스코프 외)
- 다크 모드 (스코프 외)

## 대안 검토 — 시도 안 함

elkjs 도 후보였으나 dagre 가 튜닝으로 만족스러운 결과를 내서 시도 안 함. 향후 한계 발견 시 (예: 300+ 노드, 복잡한 클러스터링) elkjs 고려.

## 스파이크 브랜치 처리

- `spike/react-flow-dagre` 브랜치는 보존 (실험 결과 기록용)
- `index.html` 은 폐기 가능 (CDN 의존, 실 코드와 다름)
- 본 문서(`SPIKE.md`) 는 보관
