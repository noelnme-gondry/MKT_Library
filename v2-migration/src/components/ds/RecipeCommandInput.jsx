"use client";
import { useId, useMemo, useState } from "react";
import { suggest, resolveLabel, resolveHint, toSelection } from "@/lib/vocabulary/vocabulary";
import { addStep, removeStep } from "@/lib/recipe/recipe";
import { fieldLabels } from "@/lib/toolIndex";
import { matchText } from "@/lib/vocabulary/hangulMatch";

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
 *    거절하면 { handled: true, code }를 반환한다. 성공 안내 대신 사유를 표시한다.
 *  - extraChips: [{ id, label, onRemove }] — 입력창 밖이 소유한 조건(공용 필터)을 같은 칩 줄에 보인다.
 *  - presets: { status, recipes:[{name, steps}], canApply, save(name, steps) } — 계정에 이름 붙여 저장한
 *    설정(useAccountRecipes). 이름으로 치면 후보 맨 위에 뜨고, 고르면 칩 목록을 그 설정으로 바꾼다.
 */
const REJECT_TEXT = {
  METRIC_NOT_SUPPORTED: ["이 도구에서 쓸 수 없는 지표", "Metric not available in this tool"],
  PERIOD_NOT_SUPPORTED: ["이 도구에서 쓸 수 없는 기간", "Period not available in this tool"],
  LOCKED_BLOCK: ["결과의 근거라 숨길 수 없음", "Evidence cannot be hidden"],
  FORMAT_NOT_SUPPORTED: ["이 도구에서 받을 수 없는 형식", "Format not available in this tool"],
  INVALID_LEVELS: ["축은 최대 3단까지", "Up to 3 levels"],
  DUPLICATE_LEVEL: ["같은 축이 두 번 들어감", "Same level used twice"],
  MISSING_FIELD: ["필요한 컬럼이 없음", "Required column missing"],
  EMPTY_SCOPE: ["분석할 값이 남지 않아 적용하지 않았습니다. 필터에서 다른 값을 선택해 주세요.", "Not applied because no values would remain. Select another value in the filter."],
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
  presets = null,
}) {
  const en = locale === "en";
  const tr = (ko, eng) => (en ? eng : ko);
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [lastPick, setLastPick] = useState("");
  const [pickError, setPickError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMessage, setSaveMessage] = useState(null);

  const options = useMemo(() => {
    if (!open) return [];
    // 저장한 설정은 이름으로 찾고 사전 단어보다 위에(최대 3개) — 가장 자주 쓰는 길이다.
    const saved = (presets?.recipes || [])
      .filter((recipe) => matchText(query, recipe.name) != null)
      .slice(0, 3)
      .map((recipe) => ({ kind: "preset", id: `preset:${recipe.name}`, recipe, enabled: true, label: { ko: `저장한 설정 · ${recipe.name}`, en: `Saved setup · ${recipe.name}` } }));
    return [...saved, ...suggest(vocabulary, query, { ...context, locale })];
  }, [open, vocabulary, query, context, locale, presets?.recipes]);
  const activeIndex = options.length ? Math.min(active, options.length - 1) : -1;
  const rejectedKeys = new Map(rejected.map((item) => [JSON.stringify([item.step?.id, item.step?.params]), item.code]));

  const pick = (option) => {
    if (!option?.enabled) return;
    setPickError(null);
    if (option.kind === "preset") {
      // 저장한 설정은 칩 목록을 통째로 바꾼다. 지금 데이터에 없는 컬럼이 필요한 단계는
      // 칩으로 남아 "적용 안 됨: 필요한 컬럼이 없음"을 보인다(foldSteps).
      onStepsChange(option.recipe.steps.reduce((acc, step) => addStep(acc, step, vocabulary), []));
      setLastPick(option.label[locale]);
      setQuery("");
      setActive(0);
      return;
    }
    const selection = toSelection(option);
    if (selection.mapping && onMapping) onMapping(selection.mapping);
    const outcome = onSelectStep?.(selection.step);
    if (outcome?.handled && outcome.code) {
      setLastPick("");
      setPickError((REJECT_TEXT[outcome.code] || [outcome.code, outcome.code])[en ? 1 : 0]);
      return;
    }
    if (!(outcome === true || outcome?.handled)) onStepsChange(addStep(steps, selection.step, vocabulary));
    setLastPick(option.label[locale]);
    setQuery("");
    setActive(0);
    // 포커스는 옮기지 않아도 된다 — 목록 선택은 mousedown에서 preventDefault로 입력창 포커스를 지킨다.
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

  const saveHref = (path) => (en ? `/en${path}` : path);
  const startSave = () => {
    setSaveMessage(null);
    if (presets?.status === "signedOut") {
      setSaveMessage({ text: tr("로그인하면 이 설정을 이름 붙여 계정에 저장하고 다른 기기에서도 불러올 수 있습니다.", "Sign in to save this setup under a name and load it on other devices."), href: saveHref("/account"), link: tr("로그인", "Sign in") });
      return;
    }
    if (presets?.status === "ready" && !presets.canApply) {
      setSaveMessage({ text: tr("설정 저장은 Pro(7일 체험 포함)에서 쓸 수 있습니다. 저장한 설정은 만료 후에도 볼 수 있고 지울 수 있습니다.", "Saving setups needs Pro (including the 7-day trial). Saved setups stay viewable and deletable after expiry."), href: saveHref("/subscription"), link: tr("Pro 안내", "About Pro") });
      return;
    }
    setSaving(true);
  };
  const submitSave = async (event) => {
    event.preventDefault();
    const name = saveName.trim();
    if (!name) return;
    const result = await presets.save(name, steps);
    if (result.ok) {
      setSaving(false);
      setSaveName("");
      setSaveMessage({ text: result.skipped
        ? tr(`'${name}'으로 저장했습니다. 데이터 값이 든 설정 ${result.skipped}개('Meta만 분석' 등)는 계정에 보내지 않았습니다.`, `Saved as '${name}'. ${result.skipped} setting(s) containing data values were not sent to your account.`)
        : tr(`'${name}'으로 저장했습니다. 입력창에 이름을 치면 불러올 수 있습니다.`, `Saved as '${name}'. Type its name in the box to load it.`) });
    } else {
      setSaveMessage({ text: result.code === "NOTHING_TO_SAVE"
        ? tr("계정에 저장할 수 있는 설정이 없습니다. 데이터 값이 든 설정('Meta만 분석' 등)은 기기에만 남습니다.", "Nothing to save to your account. Settings containing data values stay on this device.")
        : result.code === "RECIPE_LIMIT"
          ? tr("계정당 최대 100개까지 저장할 수 있습니다. 마이페이지에서 안 쓰는 설정을 지워 주세요.", "You can keep up to 100 setups. Delete unused ones in My account.")
          : tr("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "Could not save. Please try again.") });
    }
  };

  const listId = `${baseId}-list`;
  const optionId = (index) => `${baseId}-opt-${index}`;
  const labelId = `${baseId}-label`;

  return (
    <div className="recipe-command">
      <div className="recipe-command__head">
        <p className="recipe-command__label" id={labelId}>{label || tr("분석 설정", "Analysis setup")}</p>
        {presets && steps.length > 0 && !saving && (
          <button type="button" className="recipe-command__save" onClick={startSave}>{tr("이 설정 저장", "Save this setup")}</button>
        )}
      </div>
      {saving && (
        <form className="recipe-command__save-form" onSubmit={submitSave}>
          <label>
            <span>{tr("설정 이름", "Setup name")}</span>
            <input type="text" value={saveName} maxLength={40} onChange={(event) => setSaveName(event.target.value)} placeholder={tr("예: 주간 보고용", "e.g. Weekly report")} autoFocus />
          </label>
          <button type="submit" className="btn primary" disabled={!saveName.trim()}>{tr("저장", "Save")}</button>
          <button type="button" className="btn ghost" onClick={() => { setSaving(false); setSaveName(""); }}>{tr("취소", "Cancel")}</button>
        </form>
      )}
      {saveMessage && (
        <p className="recipe-command__save-message" role="status">
          {saveMessage.text}{saveMessage.href && <> <a href={saveMessage.href}>{saveMessage.link}</a></>}
        </p>
      )}
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
              const hint = option.kind === "preset"
                ? tr(`설정 ${option.recipe.steps.length}개`, `${option.recipe.steps.length} settings`)
                : option.enabled ? resolveHint(option.entry, option.params, context)?.[locale] : missingText(option.missing, locale);
              return (
                <li
                  key={`${option.id}-${JSON.stringify(option.params || {})}`}
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
      <p className={pickError ? "recipe-command__chip-reason" : "sr-only"} role="status" aria-live="polite">{pickError || (lastPick ? tr(`${lastPick} 적용`, `${lastPick} applied`) : "")}</p>
      {notices.length > 0 && (
        <ul className="recipe-command__notices">
          {notices.map((notice) => <li key={notice}>{notice}</li>)}
        </ul>
      )}
    </div>
  );
}
