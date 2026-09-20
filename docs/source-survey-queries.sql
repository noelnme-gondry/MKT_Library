-- Railway PostgreSQL Query에서 실행. 응답 원문에는 자유 입력 개인정보가 포함될 수 있음.
-- 최근 30일 응답 (한국 시간)
SELECT created_at AT TIME ZONE 'Asia/Seoul' AS submitted_at_kst,
       answer, locale, entry_surface
FROM gop_source_survey
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 500;

-- 일별 제출 수: 방문자 수나 고유 사용자 수가 아님
SELECT (created_at AT TIME ZONE 'Asia/Seoul')::date AS submitted_date_kst,
       COUNT(*) AS response_count
FROM gop_source_survey
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1 DESC;

-- 진입 화면별 제출 수: 외부 유입 채널은 answer 원문에서 확인
SELECT entry_surface, locale, COUNT(*) AS response_count
FROM gop_source_survey
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY entry_surface, locale
ORDER BY response_count DESC;
