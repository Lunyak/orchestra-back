import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // IPC-обёртки (безопасно)
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
    return () => ipcRenderer.removeListener(channel, listener);
  },
  off: (channel, listener) => {
    ipcRenderer.off(channel, listener);
  },

  // Специальные команды для файлов — вызывают ipc в main
  saveScene: (name, data) =>
    ipcRenderer.invoke('save-scene', { name, data }),

  saveProjectScene: (projectName, sceneName, data) =>
    ipcRenderer.invoke('save-project-scene', { projectName, sceneName, data }),

  saveProjectConfig: (projectName, config) =>
    ipcRenderer.invoke('save-project-config', { projectName, config }),

  readProjectScene: (projectName, sceneName) =>
    ipcRenderer.invoke('read-project-scene', { projectName, sceneName }),

  pickProjectImage: (projectName) =>
    ipcRenderer.invoke('pick-project-image', { projectName }),

  addProjectImage: (projectName, data, mimeType, originalName) =>
    ipcRenderer.invoke('add-project-image', {
      projectName,
      data,
      mimeType,
      originalName,
    }),

  getProjectImagesBase: (projectName) =>
    ipcRenderer.invoke('get-project-images-base', { projectName }),

  pickProjectAudio: (projectName) =>
    ipcRenderer.invoke('pick-project-audio', { projectName }),

  addProjectAudio: (projectName, filePaths) =>
    ipcRenderer.invoke('add-project-audio', { projectName, filePaths }),

  deleteProjectAudio: (projectName, file) =>
    ipcRenderer.invoke('delete-project-audio', { projectName, file }),

  pickProjectSound: (projectName) =>
    ipcRenderer.invoke('pick-project-sound', { projectName }),

  pickProjectModel: (projectName) =>
    ipcRenderer.invoke('pick-project-model', { projectName }),

  pickProjectSoundIcon: (projectName) =>
    ipcRenderer.invoke('pick-project-sound-icon', { projectName }),

  deleteProjectSound: (projectName, file) =>
    ipcRenderer.invoke('delete-project-sound', { projectName, file }),

  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (name) => ipcRenderer.invoke('create-project', { name }),
  deleteProject: (name) => ipcRenderer.invoke('delete-project', { name }),

  // Тестовый пинг
  ping: () => 'pong',
});