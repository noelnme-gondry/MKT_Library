// 운영 플래너는 보고서 대신 액션 작업대가 기본 결과다. 도구별 진입 계약을 한곳에 둔다.
export const toolResultSelector = toolId => toolId === "5-31" ? ".ops-plan" : ".result-action-card";
export const toolResultEntrySelector = toolId => toolId === "5-31" ? "#ops-plan-title" : ".result-action-card__headline";
