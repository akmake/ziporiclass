import api from '@/utils/api.js'; // שימוש בקובץ התקשורת המרכזי

// --- Project CRUD ---
export const getProjects = async () => {
  const { data } = await api.get('/projects');
  return data;
};

export const getProject = async (id) => {
  const { data } = await api.get(`/projects/${id}`);
  return data;
};

export const createProject = async (body) => {
  const { data } = await api.post('/projects', body);
  return data;
};

export const updateProject = async (id, body) => {
  const { data } = await api.patch(`/projects/${id}`, body);
  return data;
};

export const deleteProject = async (id) => {
  const { data } = await api.delete(`/projects/${id}`);
  return data;
};

// --- Funds ---
export const addFund = async (projectId, fund) => {
  const { data } = await api.post(`/projects/${projectId}/funds`, fund);
  return data;
};

// --- Tasks ---
export const addTask = async (projectId, task) => {
  const { data } = await api.post(`/projects/${projectId}/tasks`, task);
  return data;
};

export const toggleTask = async (projectId, taskId) => {
  const { data } = await api.patch(`/projects/${projectId}/tasks/${taskId}/toggle`);
  return data;
};

export const deleteTask = async (projectId, taskId) => {
  const { data } = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
  return data;
};