// Get the base URL for API calls - Electron desktop app
const getBaseUrl = () => {
    // Use configured port or default to 30000-39999 range for Electron desktop app
    const port = window.electronAPI?.getConfig?.()?.PORT || '30000';
    return `http://localhost:${ port }`;
};

// Utility function for API calls
export const apiFetch = (url, options = {}) => {
    const baseUrl = getBaseUrl();
    const fullUrl = url.startsWith('http') ? url : `${ baseUrl }${ url }`;

    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    return fetch(fullUrl, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });
};

// API endpoints
export const api = {
    config: () => apiFetch('/api/config'),
    projects: () => apiFetch('/api/projects'),
    sessions: (projectName, limit = 5, offset = 0) =>
        apiFetch(`/api/projects/${ projectName }/sessions?limit=${ limit }&offset=${ offset }`),
    sessionMessages: (projectName, sessionId) =>
        apiFetch(`/api/projects/${ projectName }/sessions/${ sessionId }/messages`),
    renameProject: (projectName, displayName) =>
        apiFetch(`/api/projects/${ projectName }/rename`, {
            method: 'PUT',
            body: JSON.stringify({ displayName }),
        }),
    deleteSession: (projectName, sessionId) =>
        apiFetch(`/api/projects/${ projectName }/sessions/${ sessionId }`, {
            method: 'DELETE',
        }),
    deleteProject: (projectName) =>
        apiFetch(`/api/projects/${ projectName }`, {
            method: 'DELETE',
        }),
    deleteProjectCompletely: (projectName) =>
        apiFetch(`/api/projects/${ projectName }/complete`, {
            method: 'DELETE',
        }),
    createProject: (path) =>
        apiFetch('/api/projects/create', {
            method: 'POST',
            body: JSON.stringify({ path }),
        }),
    readFile: (projectName, filePath) =>
        apiFetch(`/api/projects/${ projectName }/file?filePath=${ encodeURIComponent(filePath) }`),
    saveFile: (projectName, filePath, content) =>
        apiFetch(`/api/projects/${ projectName }/file`, {
            method: 'PUT',
            body: JSON.stringify({ filePath, content }),
        }),
    getFiles: (projectName) =>
        apiFetch(`/api/projects/${ projectName }/files`),
    transcribe: (formData) =>
        apiFetch('/api/transcribe', {
            method: 'POST',
            body: formData,
            headers: {}, // Let browser set Content-Type for FormData
        }),
    getAppInfo: () =>
        apiFetch('/api/app/info'),
    uploadImages: (projectName, formData) =>
        apiFetch(`/api/projects/${ projectName }/upload-images`, {
            method: 'POST',
            body: formData,
            headers: {}, // Let browser set Content-Type for FormData
        }),
    getProjectMemory: (projectName) =>
        apiFetch(`/api/projects/${ projectName }/memory`),
    saveProjectMemory: (projectName, content) =>
        apiFetch(`/api/projects/${ projectName }/memory`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),
    getGlobalMemory: () =>
        apiFetch('/api/memory/global'),
    saveGlobalMemory: (content) =>
        apiFetch('/api/memory/global', {
            method: 'POST',
            body: JSON.stringify({ content }),
        }),

    // Model configuration API
    model: {
        // Get current model configuration
        getCurrent: () => apiFetch('/api/model'),
        
        // Set model
        set: (model) => apiFetch('/api/model', {
            method: 'POST',
            body: JSON.stringify({ model })
        }),
        
        // List available models
        list: () => apiFetch('/api/model/list')
    },
};