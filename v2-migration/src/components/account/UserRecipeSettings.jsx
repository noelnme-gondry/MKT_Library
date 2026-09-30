"use client";
import { useEffect, useState } from "react";
import { accountRequest } from "@/lib/account/accountClient";
import { recipeVocabularyFor } from "@/lib/recipe/toolVocabulary";
import { resolveLabel } from "@/lib/vocabulary/vocabulary";
import { toolDisplayTitle } from "@/lib/toolIndex";
import { downloadJson } from "@/utils/download";

// 계정에 이름 붙여 저장한 분석 설정 목록. 만료 후에도 열람·내보내기·삭제는 된다(매핑과 같은 규칙).
export default function UserRecipeSettings({ locale = "ko", accountId = null }) {
  const en = locale === "en";
  const tr = (ko, eng) => (en ? eng : ko);
  const [recipes, setRecipes] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    accountRequest("recipes").then((data) => { if (active && data.accountId === accountId) { setRecipes(data.recipes || []); setLoadState("ready"); } })
      .catch(() => { if (active) setLoadState("failed"); });
    return () => { active = false; };
  }, [accountId]);

  const remove = async (body) => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await accountRequest("recipes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setRecipes(data.recipes || []);
      setMessage(tr("삭제했습니다.", "Deleted."));
    } catch { setMessage(tr("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", "Could not delete. Please try again.")); }
    finally { setBusy(false); }
  };

  const stepText = (recipe) => {
    const vocabulary = recipeVocabularyFor(recipe.toolId);
    return recipe.steps.map((step) => {
      const entry = vocabulary?.get(step.id);
      return entry ? resolveLabel(entry, step.params, {})[en ? "en" : "ko"] : step.id;
    }).join(" · ");
  };

  return (
    <section className="account-mapping" aria-labelledby="account-recipe-title">
      <h3 id="account-recipe-title">{tr("내 분석 설정", "My analysis setups")} <span className="badge">Pro</span></h3>
      <p className="account-mapping__lead">{tr(
        "도구의 분석 설정 입력창에서 이름 붙여 저장한 설정입니다. 어느 기기에서든 입력창에 이름을 치면 불러옵니다. 도구·이름·고른 설정만 저장하며 'Meta만 분석'처럼 데이터 값이 든 설정과 원본 행은 보내지 않습니다.",
        "Setups saved by name from a tool's Analysis setup box. Type the name in the box on any device to load it. Only the tool, name and chosen settings are stored; settings with data values and source rows are never sent.",
      )}</p>
      {!accountId && <p>{tr("위에서 로그인하면 저장한 설정을 관리할 수 있습니다.", "Sign in above to manage saved setups.")}</p>}
      {message && <p className="account-mapping__hint" role="status">{message}</p>}
      {loadState === "failed" && accountId && <p role="alert">{tr("저장한 설정을 불러오지 못했습니다.", "Could not load saved setups.")}</p>}
      {accountId && loadState === "ready" && (recipes.length === 0
        ? <p className="account-mapping__empty">{tr("아직 저장한 설정이 없습니다.", "No saved setups yet.")}</p>
        : <table className="account-mapping__table">
          <thead><tr><th scope="col">{tr("도구", "Tool")}</th><th scope="col">{tr("이름", "Name")}</th><th scope="col">{tr("설정", "Settings")}</th><th scope="col"><span className="sr-only">{tr("삭제", "Delete")}</span></th></tr></thead>
          <tbody>
            {recipes.map((recipe) => (
              <tr key={`${recipe.toolId}-${recipe.name}`}>
                <td>{toolDisplayTitle(recipe.toolId, locale)}</td>
                <td>{recipe.name}</td>
                <td>{stepText(recipe)}</td>
                <td><button type="button" className="btn ghost" disabled={busy} onClick={() => remove({ toolId: recipe.toolId, name: recipe.name })}>{tr("삭제", "Delete")}<span className="sr-only"> {recipe.name}</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>)}
      {accountId && recipes.length > 0 && (
        <div className="account-mapping__actions">
          <button type="button" className="btn" onClick={() => downloadJson({ version: 1, recipes }, "analysis_setups")}>{tr("설정 내보내기", "Export setups")}</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => remove({ all: true })}>{tr("전체 삭제", "Delete all")}</button>
        </div>
      )}
    </section>
  );
}
