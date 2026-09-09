import { sanitizeEventMarkers } from "./eventMarkers";
import { serializeProject, headerFingerprint } from "./serializeProject";
import { createProjectRecord, initializeProjects, listProjects, readProject, updateProject, deleteProject, expireProjects } from "./repository";
import { DEFAULT_PROJECT_ID } from "./projectLimits";
import { canCreateProject } from "@/lib/subscription/entitlement";

export function projectStoreActions(set, get, emptyData) {
  return {
    activeProjectId: DEFAULT_PROJECT_ID, projects: [], projectsReady: false, projectSwitching: false,
    projectError: null, entitlement: null, upgradeReason: null,
    setEntitlement: entitlement => set({ entitlement }),
    restoreProjectConfiguration: async project => {
      if (!project || get().activeProjectId !== project.id) return;
      set({ eventMarkers: sanitizeEventMarkers(project.eventMarkers) });
      if (!project.configuration) return;
      const matches = await Promise.all(Object.entries(project.configuration.groups).map(async ([group, config]) => [group, await headerFingerprint(get().csvGroups[group]?.headers || []) === config.headerFingerprint]));
      if (get().activeProjectId === project.id) get().applyProjectConfig(project.configuration, matches.filter(([, match]) => match).map(([group]) => group));
    },
    initializeProjects: async () => {
      if (get().projectsReady || get().projectSwitching) return;
      set({ projectSwitching: true });
      try {
        if (!get().decisionPersistenceEnabled) { set({ projectsReady: true, projectSwitching: false }); return; }
        await initializeProjects(get().decisionRecords, () => get().decisionPersistenceEnabled, { eventMarkers: sanitizeEventMarkers(get().eventMarkers), configuration: await serializeProject(get()) });
        await expireProjects();
        const projects = await listProjects();
        const active = projects.find(project => project.id === get().activeProjectId) || projects[0];
        set({ projects, activeProjectId: active?.id || DEFAULT_PROJECT_ID, decisionRecords: active?.decisions || [] });
        // 파일·설정·마커까지 복원한 뒤에만 전환과 내보내기를 허용한다.
        await get().restoreWorkspaceDatasets();
        set({ projectsReady: true, projectSwitching: false });
      } catch { set({ projectsReady: false, projectSwitching: false, projectError: "storage_unavailable" }); }
    },
    refreshProjects: async () => {
      try { const projects = await listProjects(); set({ projects }); return projects; }
      catch { set({ projectError: "storage_unavailable" }); return []; }
    },
    switchProject: async (id, { saveCurrent = true } = {}) => {
      if (get().projectSwitching || !get().projectsReady) return false;
      set({ projectSwitching: true });
      try {
        const state = get();
        if (saveCurrent && state.projects.some(project => project.id === state.activeProjectId)) await updateProject(state.activeProjectId, { decisions: state.decisionRecords, configuration: await serializeProject(state), eventMarkers: sanitizeEventMarkers(state.eventMarkers) });
        const target = await readProject(id);
        if (!target) throw new Error("PROJECT_MISSING");
        await updateProject(id, {});
        set({ ...emptyData(), activeProjectId: id, decisionRecords: target.decisions || [], decisionSessionRecordIds: new Set(), projectError: null });
        await get().restoreWorkspaceDatasets();
        await get().refreshProjects();
        set({ projectSwitching: false });
        return true;
      } catch { set({ projectSwitching: false, projectError: "storage_unavailable" }); return false; }
    },
    createProject: async (name = "") => {
      if (get().projectSwitching || !get().projectsReady || !get().decisionPersistenceEnabled) return { ok: false, reason: "storage_unavailable" };
      const projects = await listProjects();
      if (!canCreateProject(projects.length, get().entitlement)) { set({ upgradeReason: "project_limit" }); return { ok: false, reason: "project_limit" }; }
      const id = projects.length === 0 ? DEFAULT_PROJECT_ID : crypto.randomUUID();
      try { await createProjectRecord(id, name, get().entitlement); }
      catch (error) { if (error.message === "PROJECT_LIMIT") return { ok: false, reason: "project_limit" }; throw error; }
      await get().refreshProjects();
      const opened = await get().switchProject(id, { saveCurrent: id !== get().activeProjectId });
      return opened ? { ok: true, id } : { ok: false, reason: "storage_unavailable" };
    },
    deleteProject: async id => {
      if (get().projectSwitching) return false;
      set({ projectSwitching: true });
      try { await deleteProject(id); } catch { set({ projectSwitching: false, projectError: "storage_unavailable" }); return false; }
      const projects = await listProjects();
      if (id === get().activeProjectId) {
        const active = projects[0];
        set({ ...emptyData(), activeProjectId: active?.id || DEFAULT_PROJECT_ID, decisionRecords: active?.decisions || [], decisionSessionRecordIds: new Set() });
        if (active) await get().restoreWorkspaceDatasets();
      }
      set({ projects, projectSwitching: false });
      return true;
    },
  };
}
