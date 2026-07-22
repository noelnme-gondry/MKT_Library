// MMM 렌더층용: 기간 전체의 채널별 평균 주간 지출·모델 예측 성과·효율.
// responseAt은 이미 선택된 adstock/포화 파라미터를 반영한 모델 곡선이며,
// 이 함수는 수학을 재추정하지 않고 화면에 읽기 쉬운 집계만 제공한다.
export function buildMmmWeeklyPerformance(panel, saturationByChannel = {}) {
  if (!panel?.ch || !panel?.week?.length) return [];
  const weekCount = panel.week.length;

  return Object.values(saturationByChannel)
    .map((channel) => {
      const spends = panel.ch[channel.key] || [];
      let totalSpend = 0;
      let totalPredicted = 0;
      let activeWeeks = 0;

      spends.forEach((rawSpend) => {
        const spend = Number(rawSpend);
        if (!Number.isFinite(spend) || spend <= 0) return;
        totalSpend += spend;
        activeWeeks += 1;
        const predicted = typeof channel.responseAt === "function" ? Number(channel.responseAt(spend)) : null;
        if (Number.isFinite(predicted) && predicted > 0) totalPredicted += predicted;
      });

      if (!(totalSpend > 0)) return null;
      const predictedCpr = totalPredicted > 0 ? totalSpend / totalPredicted : null;
      return {
        key: channel.key,
        label: channel.label || channel.key,
        activeWeeks,
        avgWeeklySpend: totalSpend / weekCount,
        avgWeeklyPredicted: totalPredicted / weekCount,
        predictedCpr,
        posteriorPositive: channel.posteriorPositive,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgWeeklySpend - a.avgWeeklySpend);
}
