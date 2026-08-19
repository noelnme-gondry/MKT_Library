"use client";
import React, { useId, useRef } from "react";

/**
 * 세그먼트 컨트롤(지표·기간·모드 선택) 공용 프리미티브.
 *
 * 왜 필요한가: `.ab-pillgroup` 마크업이 저장소 전체에 47곳 있었는데 **전부** role도
 * 키보드 지원도 없었다(감사 P1-15). claude-ux.md §1.1이 명시적으로 관장하는
 * 지표·기간·모델 선택기다. 마우스로는 동작하지만 화살표 이동·그룹 인식이 없다.
 *
 * 계약(WebRMmmAdvanced.jsx의 기존 정답 구현과 동일):
 *  - 컨테이너 role="radiogroup" + aria-labelledby(라벨 span)
 *  - 각 옵션 role="radio" + aria-checked
 *  - 로빙 tabindex(선택 항목만 0) → Tab 한 번으로 진입
 *  - Arrow/Home/End 이동, disabled 옵션은 건너뜀
 *
 * 현재 상태(2026-08-19 실측): 손으로 쓴 `.ab-pillgroup`이 아직 94곳·13파일 남아 있고
 * 전역 `LegacyPillGroupA11y`가 런타임에 같은 계약을 붙여 준다. **새 화면은 여기를 쓴다** —
 * `ds/legacyPillRatchet.test.js`가 legacy 마크업이 늘어나는 것을 막는다.
 *
 * options: [{ value, label, disabled?, title? }]
 * extra: 선택지가 아닌 부가 버튼(예: "커스텀 지표") — radiogroup 밖에 렌더된다.
 */
export default function PillGroup({ label, options = [], value, onChange, extra = null, style, className = "" }) {
  const labelId = useId();
  const groupRef = useRef(null);

  const enabledIndexes = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const focusAt = (targetIndex) => {
    groupRef.current?.querySelector(`[data-pill-index="${targetIndex}"]`)?.focus();
  };

  const onKeyDown = (event, index) => {
    if (!enabledIndexes.length) return;
    const pos = enabledIndexes.indexOf(index);
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = enabledIndexes[(pos + 1) % enabledIndexes.length];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
    else if (event.key === "Home") next = enabledIndexes[0];
    else if (event.key === "End") next = enabledIndexes[enabledIndexes.length - 1];
    if (next == null) return;
    event.preventDefault();
    focusAt(next);
    onChange?.(options[next].value);
  };

  // 선택된 항목이 없으면 첫 활성 옵션이 탭 스톱이 된다(라디오 그룹 표준 동작).
  const selectedIndex = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0];

  return (
    <div className={`ab-pillgroup ${className}`.trim()} style={style}>
      {label && <span className="ab-pillgroup-label" id={labelId}>{label}</span>}
      <div ref={groupRef} role="radiogroup" aria-labelledby={label ? labelId : undefined} style={{ display: "contents" }}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={index === tabStopIndex ? 0 : -1}
            data-pill-index={index}
            disabled={option.disabled}
            title={option.title}
            className={`ab-pill ${option.value === value ? "active" : ""} ${option.disabled ? "disabled" : ""}`.replace(/\s+/g, " ").trim()}
            onClick={() => !option.disabled && onChange?.(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}
