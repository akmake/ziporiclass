import { create } from 'zustand';
import * as projectApi from '@/utils/projects';

const useProjectsStore = create((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,
  error: null,

  // Helper to update a project in the state array and the active project if necessary
  _updateProjectState: (updatedProject) => {
    const projects = get().projects.map(p => p._id === updatedProject._id ? updatedProject : p);
    const activeProject = get().activeProject?._id === updatedProject._id ? updatedProject : get().activeProject;
    return { projects, activeProject };
  },

  // --- Actions ---
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectApi.getProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: err, loading: false });
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const project = await projectApi.getProject(id);
      const { projects } = get()._updateProjectState(project);
      set({ projects, activeProject: project, loading: false });
    } catch (err) {
      set({ error: err, loading: false });
    }
  },

  createProject: async (payload) => {
    set({ loading: true, error: null });
    try {
      const newProject = await projectApi.createProject(payload);
      set(state => ({ projects: [newProject, ...state.projects], loading: false }));
      return newProject;
    } catch (err) {
      set({ error: err, loading: false });
      throw err;
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null });
    try {
      await projectApi.deleteProject(id);
      set(state => ({
        projects: state.projects.filter(p => p._id !== id),
        activeProject: state.activeProject?._id === id ? null : state.activeProject,
        loading: false
      }));
    } catch (err) {
      set({ error: err, loading: false });
    }
  },
  
  // --- Task & Fund Actions ---
  // A generic handler for actions that update a single project
  _handleProjectUpdate: async (apiCall) => {
    set({ loading: true, error: null });
    try {
      const updatedProject = await apiCall();
      const newState = get()._updateProjectState(updatedProject);
      set({ ...newState, loading: false });
    } catch (err) {
      set({ error: err, loading: false });
    }
  },

  addTask: async (projectId, task) => {
    await get()._handleProjectUpdate(() => projectApi.addTask(projectId, task));
  },

  toggleTask: async (projectId, taskId) => {
    await get()._handleProjectUpdate(() => projectApi.toggleTask(projectId, taskId));
  },

  deleteTask: async (projectId, taskId) => {
    await get()._handleProjectUpdate(() => projectApi.deleteTask(projectId, taskId));
  },

  addFund: async (projectId, fund) => {
    await get()._handleProjectUpdate(() => projectApi.addFund(projectId, fund));
  },

}));

export default useProjectsStore;
