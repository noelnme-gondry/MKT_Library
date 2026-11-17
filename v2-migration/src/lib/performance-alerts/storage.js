import { projectTransaction, migrateLegacyProject, updateProject } from "@/lib/project/repository";
import { projectMetaKey, DEFAULT_PROJECT_ID, PROJECT_LIMITS } from "@/lib/project/projectLimits";
import { requestResult } from "@/lib/workspace-storage/db";
import { hasPaidAccess } from "@/lib/subscription/entitlement";
import { isDemoData } from "@/lib/dataOrigin";
import { MAX_ALERT_RULES, collectAlertDays, applyAlertDays, sameAlertSeries, sanitizeAlertRules } from "./rules";

export const ruleConfiguration = rules => JSON.stringify((rules || []).map(({ history, checkedAt, end, issue, ...configuration }) => configuration));
export async function saveAlertRule({ projectId, projectName, rule, entitlement, shouldSave, sourceData }) {
  if (!hasPaidAccess(entitlement)) throw new Error("PRO_REQUIRED");
  const observations = sourceData ? collectAlertDays(rule, sourceData) : null;
  return projectTransaction("readwrite", async meta => {
    const projects = (await requestResult(meta.getAll())).filter(item => item.key === `project:${item.id}`);
    let project = projects.find(item => item.id === projectId);
    if (!project) {
      if (projects.length || !projectName.trim()) throw new Error("PROJECT_REQUIRED");
      project = { ...migrateLegacyProject(null, [], [], Date.now()), name: projectName.trim().slice(0, 120), id: DEFAULT_PROJECT_ID, key: projectMetaKey(DEFAULT_PROJECT_ID) };
    }
    const existing = project.performanceAlerts || [];
    if (!existing.some(item => item.id === rule.id) && existing.length >= MAX_ALERT_RULES) throw new Error("ALERT_LIMIT");
    const previous = existing.find(item => item.id === rule.id);
    let nextRule = { ...rule, enabled: previous ? previous.enabled : rule.enabled };
    if (observations) nextRule = applyAlertDays({ ...nextRule, history: sameAlertSeries(previous, rule) ? previous.history : [] }, observations);
    const performanceAlerts = [...existing.filter(item => item.id !== rule.id), sanitizeAlertRules([nextRule])[0]];
    const next = { ...project, performanceAlerts, lastUsedAt: Date.now() };
    if (new Blob([JSON.stringify(next)]).size > PROJECT_LIMITS.metadataBytes) throw new Error("PROJECT_METADATA_LIMIT");
    if (!shouldSave()) throw new Error("SAVE_CONTEXT_CHANGED");
    if (!hasPaidAccess(entitlement)) throw new Error("PRO_REQUIRED");
    meta.put(next);
    return next;
  });
}

// One shared observer covers Analyze and confirmed handoffs. No CSV is sent out.
export function observeAlertChecks(store, schedule = work => {
  let first, second;
  first = requestAnimationFrame(() => { second = requestAnimationFrame(work); });
  return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
}) {
  let last = null, cancel = () => {}, stopped = false;
  const observe = state => {
    const data = state.csvGroups.efficiency;
    const project = state.projects.find(item => item.id === state.activeProjectId);
    const rules = project?.performanceAlerts || [];
    if (stopped || state.activeDataGroup !== "efficiency" || !data?.raw?.length || isDemoData(data)
      || !state.isGroupAnalyzed("5-31") || !state.projectsReady || state.projectSwitching
      || !state.decisionPersistenceEnabled || !hasPaidAccess(state.entitlement) || !rules.some(rule => rule.enabled)) return;
    const configuration = ruleConfiguration(rules);
    if (last?.raw === data.raw && last.mapping === data.mapping && last.currency === data.currency && last.projectId === project.id && last.configuration === configuration && last.confirmation === state.analyzedByGroup) return;
    const token = { raw: data.raw, mapping: data.mapping, currency: data.currency, projectId: project.id, configuration, confirmation: state.analyzedByGroup };
    last = token; cancel();
    store.setState({ performanceAlertCheck: { projectId: project.id, raw: data.raw, status: "checking" } });
    const valid = () => {
      const current = store.getState();
      return !stopped && last === token && current.activeProjectId === project.id && !current.projectSwitching
        && current.csvGroups.efficiency?.raw === data.raw && current.csvGroups.efficiency?.mapping === data.mapping
        && current.csvGroups.efficiency?.currency === data.currency && current.decisionPersistenceEnabled
        && hasPaidAccess(current.entitlement) && ruleConfiguration(current.projects.find(item => item.id === project.id)?.performanceAlerts) === configuration;
    };
    cancel = schedule(() => {
      if (!valid()) return;
      const checked = new Map();
      // Yield between rules; the Analyze feedback is painted before scanning rows.
      const run = async () => {
        for (const rule of rules.filter(item => item.enabled)) {
          if (!valid()) return;
          checked.set(rule.id, collectAlertDays(rule, data));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        const saved = await updateProject(project.id, current => {
          if (ruleConfiguration(current.performanceAlerts) !== configuration) throw new Error("SAVE_CONTEXT_CHANGED");
          return { performanceAlerts: current.performanceAlerts.map(rule => checked.has(rule.id) ? applyAlertDays(rule, checked.get(rule.id)) : rule) };
        }, valid, state.entitlement);
        if (saved && valid()) {
          const projects = await store.getState().refreshProjects();
          if (!projects.some(item => item.id === project.id)) throw new Error("PROJECT_REFRESH_FAILED");
          if (valid()) store.setState({ performanceAlertCheck: { projectId: project.id, raw: data.raw, status: "done" } });
        }
      };
      run().catch(async error => {
        if (!valid()) return;
        if (error.message === "SAVE_CONTEXT_CHANGED") await store.getState().refreshProjects();
        else store.setState({ performanceAlertCheck: { projectId: project.id, raw: data.raw, status: "error" } });
      });
    });
  };
  const unsubscribe = store.subscribe(observe);
  observe(store.getState());
  return () => { stopped = true; cancel(); unsubscribe(); };
}
