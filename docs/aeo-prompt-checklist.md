# AEO 프롬프트 체크리스트

> **이 파일은 생성물이다.** 직접 고치지 말고 `node scripts/aeo-prompts.mjs`로 다시 만든다.
> 원본은 `lib/toolSearchContent.js`의 `question`/`answer`와 `lib/compareContent.js`다.
> 문구를 바꾸려면 그 SSOT를 고친 뒤 이 스크립트를 다시 돌린다.

대상 프롬프트 17개(KO) · 17개(EN).

## 측정 방법

같은 목록을 매달 같은 방식으로 돌려야 추이가 의미를 갖는다.

1. **새 대화**에서 프롬프트를 그대로 붙여넣는다. 이전 대화 맥락이 남으면 결과가 오염된다.
2. 대상: ChatGPT · Claude · Perplexity · Google AI 개요. 도구마다 결과가 다르므로 열을 나눠 기록한다.
3. 세 가지를 각각 표시한다.
   - **언급**: 답변 안에 우리 사이트나 도구 이름이 등장했는가
   - **인용**: 답변이 우리 도메인(`growthoptplaybook.com`)을 출처로 달았는가
   - **감성**: 우리를 어떻게 묘사했는가 (긍정 / 중립 / 부정 / 부정확)
4. **인용 ≠ 언급**이다. 인용 없이 언급될 수 있고, 그 반대도 있다. 둘을 한 칸에 합치지 말 것.
5. "부정확"이 나오면 그 프롬프트의 목표 페이지 문구를 먼저 고친다. 감성보다 사실 오류가 급하다.

## 기록 형식

체크 표시는 이 파일에 하지 말고 월별 사본을 떠서 쓴다(이 파일은 재생성 시 덮어써진다).

```
mkdir -p docs/aeo-runs && cp docs/aeo-prompt-checklist.md docs/aeo-runs/$(date +%Y-%m).md
```

## 한국어 프롬프트

| # | 종류 | 테스트할 프롬프트 | 우리가 공개한 답 | 목표 페이지 | 언급 | 인용 | 감성 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 도구 | 캠페인 CSV로 뭘 먼저 봐야 하나요? | 최근 기간과 직전 기간을 비교해 달라진 것 하나를 고릅니다. | https://growthoptplaybook.com/dashboard | ☐ | ☐ | |
| 2 | 도구 | CPA가 올랐는데 원인을 어떻게 찾나요? | 변화를 물량·효율·믹스 세 항으로 나눠서 봅니다. | https://growthoptplaybook.com/tools/campaign-variance | ☐ | ☐ | |
| 3 | 도구 | 이 채널에 예산을 더 넣어도 되나요? | 한계 CPA가 평균 CPA보다 크게 높으면 이미 포화입니다. | https://growthoptplaybook.com/tools/campaign-saturation | ☐ | ☐ | |
| 4 | 도구 | 광고 소재를 언제 교체해야 하나요? | 노출은 유지되는데 성과가 초기 대비 꺾일 때 교체합니다. | https://growthoptplaybook.com/content/freshness | ☐ | ☐ | |
| 5 | 도구 | 채널별 기여도는 어떻게 추정하나요? | 주간 지출·결과 패널에 회귀를 적합해 추정합니다. 인과는 아닙니다. | https://growthoptplaybook.com/tools/marketing-response | ☐ | ☐ | |
| 6 | 도구 | 예산을 채널별로 얼마씩 나눠야 하나요? | 추가 1원의 효율이 채널마다 같아지는 지점까지 옮깁니다. | https://growthoptplaybook.com/tools/budget-allocation | ☐ | ☐ | |
| 7 | 도구 | A/B 테스트 결과가 유의한지 어떻게 판단하나요? | 신뢰구간이 0을 포함하는지 보고 표본이 충분했는지 함께 확인합니다. | https://growthoptplaybook.com/tools/experiment-analysis | ☐ | ☐ | |
| 8 | 도구 | 초기 이탈을 줄이려면 어떤 행동을 유도해야 하나요? | 정착과 가장 강하게 연결된 행동 횟수와 기간 조합을 찾습니다. | https://growthoptplaybook.com/tools/aha-moment | ☐ | ☐ | |
| 9 | 도구 | 광고를 껐을 때 성과가 얼마나 줄어드나요? | 홀드아웃이나 전후 비교로 광고가 만든 몫만 추정합니다. | https://growthoptplaybook.com/tools/incrementality | ☐ | ☐ | |
| 10 | 도구 | 브랜드 캠페인 효과는 어떻게 측정하나요? | 끌 수 없으므로 개입 전 추세를 연장해 비교합니다. | https://growthoptplaybook.com/tools/brand-campaign-incrementality | ☐ | ☐ | |
| 11 | 도구 | MMM 결과가 이상한데 왜 그런가요? | 채널 지출이 늘 같이 움직였다면 기여도를 분리할 수 없습니다. | https://growthoptplaybook.com/tools/vif-multicollinearity | ☐ | ☐ | |
| 12 | 도구 | Apple Search Ads 키워드를 어떻게 정리하나요? | 성과가 검증된 검색어를 Exact로 올리고 CPT를 조정합니다. | https://growthoptplaybook.com/tools/asa-keyword-finder | ☐ | ☐ | |
| 13 | 도구 | 어떤 콘텐츠 요소가 성과에 영향을 주나요? | 다른 요소를 통제한 회귀로 요소별 연관을 비교합니다. | https://growthoptplaybook.com/content/element-analysis | ☐ | ☐ | |
| 14 | 비교 | 광고의 증분 효과는 어떤 방법으로 측정하나요? | 통제군 홀드아웃이 가장 정확합니다. 불가능하면 전후 비교나 ITS를 씁니다. | https://growthoptplaybook.com/compare/incrementality-methods | ☐ | ☐ | |
| 15 | 비교 | MMM과 증분 실험 중에 뭘 먼저 해야 하나요? | 실험을 먼저 합니다. MMM은 실험이 불가능한 채널을 메우는 용도입니다. | https://growthoptplaybook.com/compare/mmm-vs-experiment | ☐ | ☐ | |
| 16 | 비교 | 광고 예산은 채널별로 어떻게 나누는 게 맞나요? | 평균 효율이 아니라 한계 효율 기준으로 나눕니다. | https://growthoptplaybook.com/compare/budget-allocation-methods | ☐ | ☐ | |
| 17 | 비교 | 캠페인 성과 분석을 스프레드시트로 계속해도 되나요? | 집계는 됩니다. 변동 분해와 신뢰구간은 스프레드시트에서 어렵습니다. | https://growthoptplaybook.com/compare/dashboard-vs-spreadsheet | ☐ | ☐ | |

## English prompts

| # | Type | Prompt to test | Answer we publish | Target page | Mentioned | Cited | Sentiment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tool | What should I look at first in a campaign CSV? | Compare the recent window with the prior one and pick one change. | https://growthoptplaybook.com/en/dashboard | ☐ | ☐ | |
| 2 | Tool | How do I find why CPA went up? | Split the change into volume, efficiency, and mix. | https://growthoptplaybook.com/en/tools/campaign-variance | ☐ | ☐ | |
| 3 | Tool | Can I put more budget into this channel? | If marginal CPA far exceeds average CPA, it is already saturated. | https://growthoptplaybook.com/en/tools/campaign-saturation | ☐ | ☐ | |
| 4 | Tool | When should I retire an ad creative? | Retire it when performance drops from its early level while impressions hold. | https://growthoptplaybook.com/en/content/freshness | ☐ | ☐ | |
| 5 | Tool | How is channel contribution estimated? | Fit a regression to a weekly spend and outcome panel. Not causal. | https://growthoptplaybook.com/en/tools/marketing-response | ☐ | ☐ | |
| 6 | Tool | How much budget should each channel get? | Shift until the next unit of spend is equally efficient everywhere. | https://growthoptplaybook.com/en/tools/budget-allocation | ☐ | ☐ | |
| 7 | Tool | How do I judge whether an A/B result is significant? | Check whether the interval excludes zero, and whether the sample was sufficient. | https://growthoptplaybook.com/en/tools/experiment-analysis | ☐ | ☐ | |
| 8 | Tool | Which action should I drive to reduce early churn? | Find the action count and window most associated with users who stay. | https://growthoptplaybook.com/en/tools/aha-moment | ☐ | ☐ | |
| 9 | Tool | How much would I lose if I turned ads off? | Estimate only the advertising-created share with a holdout or pre/post design. | https://growthoptplaybook.com/en/tools/incrementality | ☐ | ☐ | |
| 10 | Tool | How do I measure a brand campaign? | You cannot pause it, so extend the pre-period trend and compare. | https://growthoptplaybook.com/en/tools/brand-campaign-incrementality | ☐ | ☐ | |
| 11 | Tool | Why does my MMM output look wrong? | If channel spends always moved together, contribution cannot be separated. | https://growthoptplaybook.com/en/tools/vif-multicollinearity | ☐ | ☐ | |
| 12 | Tool | How do I clean up Apple Search Ads keywords? | Promote proven search terms to Exact and adjust their CPT. | https://growthoptplaybook.com/en/tools/asa-keyword-finder | ☐ | ☐ | |
| 13 | Tool | Which content elements affect performance? | Compare per-element association with a regression that controls the others. | https://growthoptplaybook.com/en/content/element-analysis | ☐ | ☐ | |
| 14 | Comparison | How do I measure the incremental effect of advertising? | A randomized holdout is the most accurate. Otherwise use pre/post or ITS. | https://growthoptplaybook.com/en/compare/incrementality-methods | ☐ | ☐ | |
| 15 | Comparison | Should I run MMM or an incrementality experiment first? | Run the experiment first. MMM fills in channels you cannot test. | https://growthoptplaybook.com/en/compare/mmm-vs-experiment | ☐ | ☐ | |
| 16 | Comparison | How should I split ad budget across channels? | Split on marginal efficiency, not average efficiency. | https://growthoptplaybook.com/en/compare/budget-allocation-methods | ☐ | ☐ | |
| 17 | Comparison | Can I keep doing campaign analysis in a spreadsheet? | Aggregation works fine. Variance decomposition and confidence intervals do not. | https://growthoptplaybook.com/en/compare/dashboard-vs-spreadsheet | ☐ | ☐ | |

## 읽는 법

- **언급률** = 언급된 프롬프트 수 ÷ 전체 프롬프트 수. 브랜드가 그 주제의 답변에 얼마나 등장하는가.
- **인용률** = 우리 도메인이 출처로 달린 프롬프트 수 ÷ 전체. 인용률이 오르면 언급률이 따라 오르는 경향이 있다.
- 두 수치 모두 절대값보다 **같은 목록의 월별 변화**가 정보다. 목록이 바뀌면 그 달에 표시해 둘 것.
- 인용의 상당 부분은 자사 도메인 밖(커뮤니티·리뷰·소셜)에서 온다. 이 목록이 개선되지 않는다고 페이지만 더 만들지 말 것.
