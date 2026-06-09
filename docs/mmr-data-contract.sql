-- =============================================================================
-- Marketing-Response Regression (5-17) — 데이터 계약 (parameterized clean pull)
-- =============================================================================
-- 목적: Tinder KR Reg/React MMM 도구(5-17)가 소비하는 주간 per-platform tidy CSV 생성.
-- ⚠ 본 쿼리 산출물은 "가설 생성·기술(association)"용이며 인과/증분 측정이 아니다.
--   cannibalization·incrementality 판정은 holdout 실험(5-15)에서만.
--
-- 사용법:
--   1) :start_date / :end_date / 테이블·컬럼명을 환경에 맞게 치환 (하드코딩 경로 금지).
--   2) 실행 → CSV export → 5-17 도구에 업로드 (브라우저 메모리에서만 처리, 서버 전송 없음).
--   3) grain: (platform × ISO-week) 1행. 2024-01-01 → 2026-04-30 (~121 ISO weeks).
--
-- 컬럼 계약 (5-17 STANDARD_FIELDS "MMR" 그룹과 1:1):
--   iso_week_start (date, ISO 주의 월요일), platform (ios|aos),
--   org_reg, paid_reg, org_react, paid_react   -- outcome counts (organic vs paid 분리)
--   spend_g_roi, spend_g_cbua, spend_meta, spend_tt, spend_brand  -- 채널 spend (Google ROI·CBUA 분리 유지, 합산 금지)
--   spend_react                                  -- paid React 전용 spend (§6.1 cannibalization 검정)
--   seollal, chuseok, pre_lny, post_chuseok_wk, other_holiday  -- holiday 더미 (반복 → 추정 가능)
--   post_chuseok_step, line_signoff_step, attr_change_step      -- STEP 더미 (영구 변화; 단일주 더미 금지)
-- =============================================================================

WITH params AS (
  SELECT
    DATE :start_date AS start_date,   -- 예: '2024-01-01'
    DATE :end_date   AS end_date      -- 예: '2026-04-30'
),

-- 1) ISO 주(월요일 시작) 스파인 — gap 없는 연속 주 보장
weeks AS (
  SELECT DATE_TRUNC('week', d)::date AS iso_week_start
  FROM (
    SELECT (SELECT start_date FROM params) + (n || ' day')::interval AS d
    FROM generate_series(
      0,
      (SELECT (end_date - start_date) FROM params)
    ) AS n
  ) g
  GROUP BY 1
),

platforms AS (SELECT 'ios' AS platform UNION ALL SELECT 'aos'),
spine AS (SELECT w.iso_week_start, p.platform FROM weeks w CROSS JOIN platforms p),

-- 2) Outcomes — organic vs paid 분리 (DV는 organic; total은 cross-check만)
--    ⚠ React 좌측절단: lapse-window lookback(30/60/90d)이 2024 초기 주에 2023 히스토리로
--    완전히 채워졌는지 확인. 미충족 선행주는 drop/flag. lapse 정의 변경 시 attr_change_step 가산.
outcomes AS (
  SELECT
    DATE_TRUNC('week', event_ts)::date AS iso_week_start,
    LOWER(platform)                    AS platform,
    SUM(CASE WHEN event_type='registration'  AND is_paid=FALSE THEN 1 ELSE 0 END) AS org_reg,
    SUM(CASE WHEN event_type='registration'  AND is_paid=TRUE  THEN 1 ELSE 0 END) AS paid_reg,
    SUM(CASE WHEN event_type='reactivation'  AND is_paid=FALSE THEN 1 ELSE 0 END) AS org_react,
    SUM(CASE WHEN event_type='reactivation'  AND is_paid=TRUE  THEN 1 ELSE 0 END) AS paid_react
  FROM user_events            -- ← 환경 테이블로 치환
  WHERE event_ts >= (SELECT start_date FROM params)
    AND event_ts <  (SELECT end_date   FROM params) + interval '1 day'
  GROUP BY 1,2
),

-- 3) Spend — 채널 분리 유지 (Google ROI + CBUA 합산 절대 금지)
spend AS (
  SELECT
    DATE_TRUNC('week', spend_date)::date AS iso_week_start,
    LOWER(platform)                      AS platform,
    SUM(CASE WHEN channel='google' AND campaign_intent='roi'  THEN cost ELSE 0 END) AS spend_g_roi,
    SUM(CASE WHEN channel='google' AND campaign_intent='cbua' THEN cost ELSE 0 END) AS spend_g_cbua,
    SUM(CASE WHEN channel='meta'    THEN cost ELSE 0 END)  AS spend_meta,
    SUM(CASE WHEN channel='tiktok'  THEN cost ELSE 0 END)  AS spend_tt,
    SUM(CASE WHEN channel='brand'   THEN cost ELSE 0 END)  AS spend_brand,
    SUM(CASE WHEN objective='reactivation' THEN cost ELSE 0 END) AS spend_react
  FROM ad_spend               -- ← 환경 테이블로 치환
  WHERE spend_date >= (SELECT start_date FROM params)
    AND spend_date <  (SELECT end_date   FROM params) + interval '1 day'
  GROUP BY 1,2
)

SELECT
  s.iso_week_start,
  s.platform,
  COALESCE(o.org_reg,0)     AS org_reg,
  COALESCE(o.paid_reg,0)    AS paid_reg,
  COALESCE(o.org_react,0)   AS org_react,
  COALESCE(o.paid_react,0)  AS paid_react,
  COALESCE(sp.spend_g_roi,0)   AS spend_g_roi,
  COALESCE(sp.spend_g_cbua,0)  AS spend_g_cbua,
  COALESCE(sp.spend_meta,0)    AS spend_meta,
  COALESCE(sp.spend_tt,0)      AS spend_tt,
  COALESCE(sp.spend_brand,0)   AS spend_brand,
  COALESCE(sp.spend_react,0)   AS spend_react,
  -- holiday 더미 (반복 추정 가능: Seollal 24/25/26, Chuseok 24/25). 날짜는 환경에 맞게 보정.
  CASE WHEN s.iso_week_start IN (DATE '2024-02-05', DATE '2025-01-27', DATE '2026-02-16') THEN 1 ELSE 0 END AS seollal,
  CASE WHEN s.iso_week_start IN (DATE '2024-09-16', DATE '2025-10-06') THEN 1 ELSE 0 END                    AS chuseok,
  CASE WHEN s.iso_week_start IN (DATE '2024-01-29', DATE '2025-01-20', DATE '2026-02-09') THEN 1 ELSE 0 END AS pre_lny,
  CASE WHEN s.iso_week_start IN (DATE '2024-09-23', DATE '2025-10-13') THEN 1 ELSE 0 END                    AS post_chuseok_wk,
  0 AS other_holiday,   -- theory-driven 시에만 1
  -- STEP 더미 (영구 변화 = 이 주부터 끝까지 1; 단일주 더미 절대 금지)
  CASE WHEN s.iso_week_start >= DATE '2025-10-06' THEN 1 ELSE 0 END AS post_chuseok_step,
  CASE WHEN s.iso_week_start >= DATE '2025-04-01' THEN 1 ELSE 0 END AS line_signoff_step,   -- ← off-date 보정
  CASE WHEN s.iso_week_start >= DATE '2024-04-01' THEN 1 ELSE 0 END AS attr_change_step      -- ← SKAN/ATT/MMP/정의 변경일 보정
FROM spine s
LEFT JOIN outcomes o ON o.iso_week_start=s.iso_week_start AND o.platform=s.platform
LEFT JOIN spend    sp ON sp.iso_week_start=s.iso_week_start AND sp.platform=s.platform
ORDER BY s.platform, s.iso_week_start;
