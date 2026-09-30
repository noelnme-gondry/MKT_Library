"use client";
import { useId, useMemo, useRef, useState } from "react";
import { suggest, resolveLabel, resolveHint, toSelection } from "@/lib/vocabulary/vocabulary";
import { addStep, removeStep } from "@/lib/recipe/recipe";
import { fieldLabels } from "@/lib/toolIndex";

/**
 * 레시피 명령 입력창(docs/result-autonomy-spec.md §3). 치면 단어 사전 후보가 아래에 뜨고,
 * 고르면 칩으로 남아 바로 적용된다. 칩을 누르면 그 조작이 빠진다. 자유 문장은 해석하지 않는다.
 *
 * props
 *  - vocabulary: buildVocabulary() Map
 *  - context: buildDataContext() 결과 + locale
 *  - steps / onStepsChange: 칩 목록(레시피 단계)
 *  - onMapping({ column, field }): 매핑이 함께 필요한 후보를 골랐을 때(기존 매핑 스토어에 쓴다)
 *  - rejected: foldSteps().rejected — 칩은 남았지만 반영되지 않은 이유
 *  - notices: 화면이 알려야 할 자동 처리(대소문자 합치기 등) 문장 목록
 *  - onSelectStep(step): 이 단계를 입력창 밖(공용 필터 등)이 소유하면 처리하고 true — 칩 대신
 *    그 소유자에 쓴다. 같은 조건이 칩과 필터 두 곳에 따로 살지 않게(2026-09-30).
 *  - extraChips: [{ id, label, onRemove }] — 입력창 밖이 소유한 조건(공용 필터)을 같은 칩 줄에 보인다.
 */
const REJECT_TEXT = {
  METRIC_NOT_SUPPORTED: ["이 도구에서 쓸 수 없는 지표", "Metric not available in this tool"],
  PERIOD_NOT_SUPPORTED: ["이 도구에서 쓸 수 없는 기간", "Period not available in this tool"],
  LOCKED_BLOCK: ["결과의 근거라 숨길 수 없음", "Evidence cannot be hidden"],
  FORMAT_NOT_SUPPORTED: ["이 도구에서 받을 수 없는 형식", "Format not available in this tool"],
  INVALID_LEVELS: ["축은 최대 3단까지", "Up to 3 levels"],
  DUPLICATE_LEVEL: ["같은 축이 두 번 들어감", "Same level used twice"],
  MISSING_FIELD: ["필요한 컬럼이 없음", "Required column missing"],
};

function missingText(missing, locale) {
  const keys = missing.map((req) => (typeof req === "string" ? req : (req?.oneOf || []).join("/")));
  const labels = fieldLabels(keys, locale);
  return locale === "en" ? `Needs: ${labels.join(", ") || keys.join(", ")}` : `필요: ${labels.join(", ") || keys.join(", ")}`;
}

export default function RecipeCommandInput({
  vocabulary,
  context,
  steps = [],
  onStepsChange,
  onMapping,
  rejected = [],
  notices = [],
  locale = "ko",
  label,
  onSelectStep,
  extraChips = [],
}) {
  const en = locale === "en";
  const tr = (ko, eng) => (en ? eng : ko);
  const baseId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [lastPick, setLastPick] = useState("");

  const options = useMemo(() => (open ? suggest(vocabulary, query, { ...context, locale }) : []), [open, vocabulary, query, context, locale]);
  const activeIndex = options.length ? Math.min(active, options.length - 1) : -1;
  const rejectedKeys = new Map(rejected.map((item) => [JSON.stringify([item.step?.id, item.step?.params]), item.code]));

  const pick = (option) => {
    if (!option?.enabled) return;
    const selection = toSelection(option);
    if (selection.mapping && onMapping) onMapping(selection.mapping);
    if (!onSelectStep?.(selection.step)) onStepsChange(addStep(steps, selection.step, vocabulary));
    setLastPick(option.label[locale]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    // 한글 조합 중 Enter는 글자 확정이지 선택이 아니다.
    if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (options.length ? (index + 1) % options.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (options.length ? (index - 1 + options.length) % options.length : 0));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0) {
        event.preventDefault();
        pick(options[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && !query) {
      if (steps.length) onStepsChange(removeStep(steps, steps.length - 1));
      else if (extraChips.length) extraChips[extraChips.length - 1].onRemove();
    }
  };

  const listId = `${baseId}-list`;
  const optionId = (index) => `${baseId}-opt-${index}`;
  const labelId = `${baseId}-label`;

  return (
    <div className="recipe-command">
      <p className="recipe-command__label" id={labelId}>{label || tr("분석 설정", "Analysis setup")}</p>
      {(steps.length > 0 || extraChips.length > 0) && (
        <ul className="recipe-command__chips" aria-label={tr("적용한 설정", "Applied settings")}>
          {extraChips.map((chip) => (
            <li key={chip.id}>
              <button type="button" className="recipe-command__chip" aria-label={tr(`${chip.label} 빼기`, `Remove ${chip.label}`)} onClick={chip.onRemove}>
                <span>{chip.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
          {steps.map((step, index) => {
            const entry = vocabulary.get(step.id);
            if (!entry) return null;
            const text = resolveLabel(entry, step.params, context)[locale];
            const code = rejectedKeys.get(JSON.stringify([step.id, step.params]));
            const reason = code ? (REJECT_TEXT[code] || [code, code])[en ? 1 : 0] : null;
            return (
              <li key={`${step.id}-${index}`}>
                <button
                  type="button"
                  className={`recipe-command__chip${code ? " is-rejected" : ""}`}
                  aria-label={tr(`${text} 빼기`, `Remove ${text}`)}
                  onClick={() => onStepsChange(removeStep(steps, index))}
                >
                  <span>{text}</span>
                  <span aria-hidden="true">×</span>
                </button>
                {reason && <span className="recipe-command__chip-reason">{tr("적용 안 됨", "Not applied")}: {reason}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="recipe-command__field">
        <input
          ref={inputRef}
          type="text"
          className="recipe-command__input"
          role="combobox"
          aria-labelledby={labelId}
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={tr("예: 채널별, 직전주와 비교, Meta만 분석", "e.g. By channel, Compare with prior week")}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {open && (
          <ul className="recipe-command__options" id={listId} role="listbox" aria-labelledby={labelId}>
            {options.length ? options.map((option, index) => {
              const hint = option.enabled ? resolveHint(option.entry, option.params, context)?.[locale] : missingText(option.missing, locale);
              return (
                <li
                  key={`${option.id}-${JSON.stringify(option.params)}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  aria-disabled={!option.enabled}
                  className={`recipe-command__option${index === activeIndex ? " is-active" : ""}${option.enabled ? "" : " is-disabled"}`}
                  // blur보다 먼저 선택되도록 mousedown에서 처리한다.
                  onMouseDown={(event) => { event.preventDefault(); pick(option); }}
                  // 목록이 멈춰 있는 포인터 밑에 열리면 mouseenter가 저절로 불려 Enter가 엉뚱한 항목을
                  // 고른다(320px에서 실측). 실제로 움직였을 때만 강조를 옮긴다.
                  onMouseMove={() => { if (index !== activeIndex) setActive(index); }}
                >
                  <span>{option.label[locale]}</span>
                  {hint && <small>{hint}</small>}
                </li>
              );
            }) : (
              <li className="recipe-command__empty" role="option" aria-disabled="true" aria-selected="false">
                {tr("해당하는 말이 없습니다. 채널별·직전주와 비교·상위 5개만 보기 같은 말을 써 보세요.", "No match. Try words like By channel, Compare with prior week, Show top 5.")}
              </li>
            )}
          </ul>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{lastPick ? tr(`${lastPick} 적용`, `${lastPick} applied`) : ""}</p>
      {notices.length > 0 && (
        <ul className="recipe-command__notices">
          {notices.map((notice) => <li key={notice}>{notice}</li>)}
        </ul>
      )}
    </div>
  );
}
