// 입력창 조건과 기존 필터 막대는 같은 상태를 쓴다. 빈 Set은 "전체"이므로 마지막 값 제외는 거절한다.
const SHARED_FILTER_KEY = { platform: "platforms", country: "countries", channel: "channels", source: "sources" };

export function sharedRecipeFilters({ csvData, dashboardFilter, setDashboardFilter, locale = "ko" }) {
  const tr = (ko, en) => locale === "en" ? en : ko;
  // 공용 필터 축의 원본 값(앞뒤 공백 제거) — 필터 막대 선택지와 같은 규칙.
  const sharedOptions = (field) => {
    const header = Object.keys(csvData?.mapping || {}).find((key) => csvData.mapping[key] === field);
    return header ? [...new Set((csvData.raw || []).map((row) => String(row?.[header] ?? "").trim()).filter(Boolean))] : [];
  };
  const routeToSharedFilter = (step) => {
    const key = SHARED_FILTER_KEY[step?.params?.field];
    const isOnly = step?.id === "filter.only.analysis";
    if (!key || !(isOnly || step?.id === "filter.exclude.analysis")) return false;
    const options = sharedOptions(step.params.field);
    // 대소문자·공백만 다른 원본 표기까지 함께 고른다 — 합쳐 계산하는 값과 필터가 어긋나지 않게.
    const wanted = new Set(step.params.values.map((value) => String(value).trim().toLowerCase()));
    const picked = options.filter((option) => wanted.has(option.toLowerCase()));
    const current = dashboardFilter[key]?.size ? [...dashboardFilter[key]] : null;
    const next = isOnly
      ? new Set([...(current || []), ...picked])
      : new Set((current || options).filter((option) => !wanted.has(option.toLowerCase())));
    // 빈 Set은 공용 필터의 "전체" 계약이다. 변경 없이 거절 사유를 입력창에 돌려준다.
    if (!next.size) return { handled: true, code: "EMPTY_SCOPE" };
    setDashboardFilter({ [key]: next.size >= options.length ? new Set() : next });
    return true;
  };
  const sharedFilterChips = [
    ...(dashboardFilter.dateStart || dashboardFilter.dateEnd ? [{
      id: "date",
      label: tr(`기간 ${dashboardFilter.dateStart || "처음"} ~ ${dashboardFilter.dateEnd || "끝"}`, `Dates ${dashboardFilter.dateStart || "start"} – ${dashboardFilter.dateEnd || "end"}`),
      onRemove: () => setDashboardFilter({ dateStart: null, dateEnd: null, compareEnabled: false, comparisonStart: null, comparisonEnd: null }),
    }] : []),
    ...Object.entries(SHARED_FILTER_KEY).filter(([, key]) => dashboardFilter[key]?.size).map(([field, key]) => {
      const values = [...dashboardFilter[key]];
      // 칩 이름은 필터 막대 버튼과 같은 말을 쓴다(같은 조건을 두 이름으로 부르지 않게).
      const name = { platform: tr("플랫폼", "Platform"), country: tr("국가", "Country"), channel: tr("채널", "Channel"), source: tr("소스", "Source") }[field];
      return {
        id: key,
        label: values.length === 1 ? `${name}: ${values[0]}` : tr(`${name}: ${values.length}개`, `${name}: ${values.length} selected`),
        onRemove: () => setDashboardFilter({ [key]: new Set() }),
      };
    }),
  ];
  return { onSelectStep: routeToSharedFilter, extraChips: sharedFilterChips };
}
