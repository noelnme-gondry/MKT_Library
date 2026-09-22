-- 유입 경로 서베이(주관식) — 서비스 시작 전에 실행하는 추가 전용 마이그레이션.
--
-- 저장하는 것: 사용자가 직접 적은 답변 한 줄, 화면 언어, 분류된 진입면
-- (lib/siteJourney.js의 고정 어휘), 제출 시각.
-- 저장하지 않는 것: IP·계정·세션 토큰·URL·검색어·CSV 행. 이 표는 사용자가
-- 타이핑한 답변 외에 어떤 사용자 데이터와도 연결되지 않는다.
--
-- id는 브라우저가 만든 난수(uuid)다. 같은 제출이 재시도로 두 번 들어오는 것만
-- 막는 용도이며 사람을 식별하지 않는다.
CREATE TABLE IF NOT EXISTS gop_source_survey (
  id uuid PRIMARY KEY,
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 300),
  locale text NOT NULL CHECK (locale IN ('ko', 'en')),
  entry_surface text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gop_source_survey_created ON gop_source_survey(created_at DESC);
