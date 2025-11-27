// client/src/stores/projectsStore.js

import { create } from 'zustand';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addFund,
  addTask,
  toggleTask,
  deleteTask,
} from '../utils/projects';

/**
 * Zustand store לניהול מצב "Projects" (יעדים / משימות) בצד‑לקוח.
 *
 * ─ הנתונים נשמרים בזיכרון הגלובלי של האפליקציה.
 * ─ כל פעולה מעדכנת את ה‑state באופן איסטנטיבי (optimistic) ואז מאמתת מול השרת.
 */
const useProjectsStore = create((set, get) => ({
  /* -------------------------------------------------------
   * State
   * ----------------------------------------------------- */
  projects: [],      // כל הפרויקטים של המשתמש
  active: null,      // פרויקט פתוח כרגע (object) או null
  loading: false,    // true בזמן פעולה א‑סינכרונית
  error: null,       // אובייקט שגיאה אחרון או null

  /* -------------------------------------------------------
   * Internal helpers
   * ----------------------------------------------------- */
  _start: () => set({ loading: true, error: null }),
  _success: (overrides = {}) => set({ loading: false, ...overrides }),
  _fail: (error) => set({ loading: false, error }),

  /* -------------------------------------------------------
   * Actions – CRUD בסיסי
   * ----------------------------------------------------- */
  fetchProjects: async () => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const projects = await getProjects();
      _success({ projects });
    } catch (err) {
      _fail(err);
    }
  },

  fetchProject: async (id) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const project = await getProject(id);
      // עדכן או הוסף ל‑projects
      const projects = [...get().projects];
      const idx = projects.findIndex((p) => p._id === id);
      if (idx > -1) projects[idx] = project; else projects.unshift(project);
      _success({ projects, active: project });
    } catch (err) {
      _fail(err);
    }
  },

  createProject: async (payload) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const project = await createProject(payload);
      _success({ projects: [project, ...get().projects] });
    } catch (err) {
      _fail(err);
    }
  },

  updateProject: async (id, payload) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const updated = await updateProject(id, payload);
      const projects = get().projects.map((p) => (p._id === id ? updated : p));
      const active   = get().active && get().active._id === id ? updated : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },

  deleteProject: async (id) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      await deleteProject(id);
      const projects = get().projects.filter((p) => p._id !== id);
      const active   = get().active && get().active._id === id ? null : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },

  /* -------------------------------------------------------
   * Goal‑type helpers (Funds)
   * ----------------------------------------------------- */
  addFund: async (projectId, fund) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const updated = await addFund(projectId, fund);
      const projects = get().projects.map((p) => (p._id === projectId ? updated : p));
      const active   = get().active && get().active._id === projectId ? updated : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },

  /* -------------------------------------------------------
   * Task‑type helpers (Tasks)
   * ----------------------------------------------------- */
  addTask: async (projectId, task) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const updated = await addTask(projectId, task);
      const projects = get().projects.map((p) => (p._id === projectId ? updated : p));
      const active   = get().active && get().active._id === projectId ? updated : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },

  toggleTask: async (projectId, taskId) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const updated = await toggleTask(projectId, taskId);
      const projects = get().projects.map((p) => (p._id === projectId ? updated : p));
      const active   = get().active && get().active._id === projectId ? updated : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },

  deleteTask: async (projectId, taskId) => {
    const { _start, _success, _fail } = get();
    try {
      _start();
      const updated = await deleteTask(projectId, taskId);
      const projects = get().projects.map((p) => (p._id === projectId ? updated : p));
      const active   = get().active && get().active._id === projectId ? updated : get().active;
      _success({ projects, active });
    } catch (err) {
      _fail(err);
    }
  },
}));

export default useProjectsStore;