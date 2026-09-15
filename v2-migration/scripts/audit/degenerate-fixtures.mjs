// R0 · 퇴화 입력 픽스처 6종 (R1~R9가 공유)
//
// 목적: "정상 데이터로는 멀쩡한데 가장자리에서 거짓 숫자를 내는가"를 도구마다
// 같은 입력으로 묻는다. 결정론 필수 — Math.random 금지(§8.3), 값은 고정 시드.
//
// 각 픽스처는 { name, why, headers, rows } 를 낸다. rows는 문자열 배열
// (PapaParse가 dynamicTyping 없이 내는 형태와 같게 — §7).

const DATES = (n, start = "2026-07-01") => {
  const base = Date.UTC(2026, 6, 1);
  void start;
  return Array.from({ length: n }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10));
};

// 결정론 노이즈(시드 고정) — demoData의 seededNoise와 같은 규율.
const seeded = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

const HEADERS = ["date", "channel", "cost", "installs", "actions", "revenue"];

const row = (date, channel, cost, installs, actions, revenue) =>
  [date, channel, String(cost), String(installs), String(actions), String(revenue)];

export const FIXTURES = {
  empty: {
    name: "0행",
    why: "헤더만 있고 데이터가 없는 파일. 빈 상태가 정직한가, 아니면 0/NaN을 결과로 내는가.",
    headers: HEADERS,
    rows: [],
  },
  single: {
    name: "1행",
    why: "기간 비교·분산·기울기가 정의되지 않는 최소 입력. n<=k 가드가 있는가.",
    headers: HEADERS,
    rows: [row("2026-07-01", "google", 100000, 200, 40, 800000)],
  },
  constant: {
    name: "상수열",
    why: "종속변수 분산 0. sst>0 가드가 없으면 R²=-Infinity·p≈0('극도로 유의')이 렌더된다(§7 실제 사례).",
    headers: HEADERS,
    rows: DATES(30).map((d, i) => row(d, i % 2 ? "google" : "meta", 100000, 200, 40, 800000)),
  },
  collinear: {
    name: "완전공선",
    why: "두 채널 지출이 정확히 비례. 역행렬 rank 판정(maxErr) 없이 pivot 임계만 보면 가비지 β·SE가 확정 숫자로 나온다.",
    headers: HEADERS,
    rows: DATES(40).flatMap((d, i) => {
      const base = 100000 + i * 2000;
      return [
        row(d, "google", base, Math.round(base / 500), Math.round(base / 2500), base * 4),
        row(d, "meta", base * 2, Math.round(base / 250), Math.round(base / 1250), base * 8),
      ];
    }),
  },
  allZero: {
    name: "전부 0",
    why: "비용·성과가 모두 0. 나눗셈이 Infinity/NaN로 새는지, '계산 불가'를 좋은 등급으로 접는지(VIF=1 사고 계열).",
    headers: HEADERS,
    rows: DATES(20).map((d, i) => row(d, i % 2 ? "google" : "meta", 0, 0, 0, 0)),
  },
  sparse: {
    name: "결측 30%",
    why: "빈 셀이 섞인 실사용 파일. 빈 문자열이 0으로 둔갑해 평균·비중을 조용히 왜곡하는지.",
    headers: HEADERS,
    rows: DATES(30).flatMap((d, i) =>
      ["google", "meta", "tiktok"].map((ch, j) => {
        const k = i * 3 + j;
        const drop = seeded(k) < 0.3;
        const cost = Math.round(80000 + seeded(k + 100) * 60000);
        return [d, ch, drop ? "" : String(cost), drop ? "" : String(Math.round(cost / 480)), String(Math.round(cost / 2400)), String(cost * 4)];
      })
    ),
  },
};

export const toCsv = (fx) => [fx.headers.join(","), ...fx.rows.map((r) => r.join(","))].join("\r\n");

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [key, fx] of Object.entries(FIXTURES)) {
    console.log(`${key.padEnd(10)} ${String(fx.rows.length).padStart(4)}행  ${fx.name} — ${fx.why}`);
  }
}
