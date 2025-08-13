// Get the base URL for API calls - Electron desktop app
const getBaseUrl = () => {
    // Use configured port or default to 3001 for Electron desktop app
    const port = window.electronAPI?.getConfig?.()?.PORT || '3001';
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
};