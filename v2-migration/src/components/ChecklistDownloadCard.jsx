"use client";

import Link from "next/link";
import { downloadText } from "@/utils/download";

const CHECKLISTS = {
  taxonomy: {
    fileName: "event-taxonomy-checklist",
    ko: {
      title: "이벤트 택소노미 설계 체크리스트",
      desc: "이벤트명·파라미터·중복·개인정보·QA 기준을 배포 전에 점검합니다.",
      href: "/guide/event-taxonomy",
      body: `# 이벤트 택소노미 설계 체크리스트

## 목적과 소유자
- [ ] 이 이벤트가 답할 비즈니스 질문을 한 문장으로 적었다.
- [ ] 이벤트 오너와 구현·검수 담당자를 정했다.
- [ ] 이벤트명은 동사+대상 규칙을 따르고 기존 이벤트와 중복되지 않는다.

## 파라미터
- [ ] 필수/선택 파라미터와 데이터 타입을 정의했다.
- [ ] 통화·시간대·플랫폼별 값 규칙을 통일했다.
- [ ] 개인 식별 정보와 민감정보를 수집하지 않는다.

## QA
- [ ] 정상·취소·중복·재시도 시나리오를 테스트했다.
- [ ] Android·iOS·Web에서 동일 의미로 수집되는지 확인했다.
- [ ] MMP·분석 도구·광고 매체의 수치 차이를 기록했다.
- [ ] 변경일·버전·담당자를 문서에 남겼다.
`,
    },
    en: {
      title: "Event taxonomy design checklist",
      desc: "Review naming, parameters, duplication, privacy, and QA before release.",
      href: "/en/guide/event-taxonomy",
      body: `# Event taxonomy design checklist

## Purpose and ownership
- [ ] Write the business question this event should answer.
- [ ] Assign an event owner plus implementation and QA owners.
- [ ] Follow the naming rule and check for duplicate meaning.

## Parameters
- [ ] Define required and optional parameters with data types.
- [ ] Standardize currency, timezone, and platform value rules.
- [ ] Do not collect personal or sensitive information.

## QA
- [ ] Test success, cancellation, duplication, and retry cases.
- [ ] Verify the same meaning across Android, iOS, and Web.
- [ ] Record differences across MMP, analytics, and ad platforms.
- [ ] Record the change date, version, and owner.
`,
    },
  },
  postback: {
    fileName: "postback-qa-checklist",
    ko: {
      title: "포스트백 연동 QA 체크리스트",
      desc: "광고 매체·MMP 포스트백의 누락, 중복, 금액, 개인정보 전송을 점검합니다.",
      href: "/guide/postback-integration",
      body: `# 포스트백 연동 QA 체크리스트

- [ ] 이벤트 발생 조건과 전송 조건이 일치한다.
- [ ] 테스트 디바이스와 광고 식별자를 기록했다.
- [ ] 설치·재설치·재참여 이벤트가 중복 집계되지 않는다.
- [ ] 매출 금액과 통화 코드가 원본 주문과 일치한다.
- [ ] 취소·환불 이벤트가 올바르게 차감된다.
- [ ] 유저 동의가 없는 개인정보를 전송하지 않는다.
- [ ] MMP 원본 로그와 매체 대시보드 수치를 비교했다.
- [ ] 지연 전송과 재시도 시 중복 방지 키가 유지된다.
- [ ] 운영 전환 후 24시간·72시간 재검수 일정을 잡았다.
`,
    },
    en: {
      title: "Postback integration QA checklist",
      desc: "Check missing or duplicate events, revenue values, retries, and privacy.",
      href: "/en/guide/postback-integration",
      body: `# Postback integration QA checklist

- [ ] Event and transmission conditions match.
- [ ] Test device and advertising identifiers are recorded.
- [ ] Install, reinstall, and re-engagement events are not duplicated.
- [ ] Revenue and currency match the source order.
- [ ] Cancellations and refunds are deducted correctly.
- [ ] No personal data is sent without valid consent.
- [ ] Compare MMP raw logs with the ad-platform dashboard.
- [ ] Retry behavior preserves the deduplication key.
- [ ] Schedule checks at 24 and 72 hours after launch.
`,
    },
  },
  media: {
    fileName: "new-media-onboarding-checklist",
    ko: {
      title: "신규 광고 매체 온보딩 체크리스트",
      desc: "목표·측정·예산·소재·중단 기준을 첫 집행 전에 고정합니다.",
      href: "/guide/kpi-analysis",
      body: `# 신규 광고 매체 온보딩 체크리스트

## 집행 전
- [ ] 매체 도입 목적과 1차 KPI를 하나로 정했다.
- [ ] 귀속창·전환 정의·MMP 연동 방식을 기록했다.
- [ ] 테스트 예산과 학습 기간, 최소 표본을 정했다.
- [ ] 기존 매체와 구분되는 소재·오디언스 가설이 있다.

## 운영
- [ ] 캠페인·광고그룹·소재 네이밍 규칙을 적용했다.
- [ ] 일 예산 상한과 비정상 지출 중단 기준을 설정했다.
- [ ] 브랜드 세이프티와 제외 지면을 확인했다.

## 판독
- [ ] 성공·보류·중단 기준을 집행 전에 적었다.
- [ ] 귀속 성과와 증분 성과를 같은 의미로 쓰지 않는다.
- [ ] 테스트 종료 후 학습·결정·다음 행동을 기록한다.
`,
    },
    en: {
      title: "New ad channel onboarding checklist",
      desc: "Fix the objective, measurement, budget, creative, and stop rules before launch.",
      href: "/en/guide/kpi-analysis",
      body: `# New ad channel onboarding checklist

## Before launch
- [ ] Choose one primary objective and KPI.
- [ ] Record attribution window, conversion definition, and MMP setup.
- [ ] Set test budget, learning period, and minimum sample.
- [ ] Define a creative or audience hypothesis that differs from existing channels.

## Operations
- [ ] Apply campaign, ad-group, and creative naming rules.
- [ ] Set a daily cap and abnormal-spend stop rule.
- [ ] Review brand safety and excluded placements.

## Readout
- [ ] Write success, hold, and stop criteria before launch.
- [ ] Do not treat attributed and incremental outcomes as the same thing.
- [ ] Record learning, decision, and next action after the test.
`,
    },
  },
};

export default function ChecklistDownloadCard({ checklistId, locale = "ko" }) {
  const item = CHECKLISTS[checklistId];
  const copy = item?.[locale];
  if (!item || !copy) return null;
  return (
    <article className="template-checklist-card">
      <span>{locale === "en" ? "MARKDOWN CHECKLIST" : "실무 체크리스트"}</span>
      <h3>{copy.title}</h3>
      <p>{copy.desc}</p>
      <div>
        <button type="button" onClick={() => downloadText(copy.body, item.fileName, "md", locale)}>
          {locale === "en" ? "Download .md" : ".md 다운로드"}
        </button>
        <Link href={copy.href}>{locale === "en" ? "Read guide →" : "관련 가이드 →"}</Link>
      </div>
    </article>
  );
}
