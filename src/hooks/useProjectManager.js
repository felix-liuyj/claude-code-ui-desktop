import { useState, useCallback, useMemo, useRef } from 'react';
import { useDebounce } from './usePerformance';

/**
 * 优化的项目管理 Hook
 * 包含缓存、防抖和内存优化
 */
export const useProjectManager = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    // 缓存相关
    const projectsCache = useRef(new Map());
    const lastFetchTime = useRef(0);
    const CACHE_DURATION = 30000; // 30 seconds

    // 防抖的项目更新函数
    const debouncedProjectsUpdate = useDebounce(setProjects, 300);

    // 优化的项目比较函数
    const compareProjects = useCallback((prevProjects, newProjects) => {
        if (prevProjects.length !== newProjects.length) return false;
        
        return prevProjects.every((prev, index) => {
            const current = newProjects[index];
            if (!current) return false;
            
            return (
                prev.name === current.name &&
                prev.displayName === current.displayName &&
                prev.fullPath === current.fullPath &&
                prev.sessions?.length === current.sessions?.length
            );
        });
    }, []);

    // 缓存的项目获取函数
    const fetchProjects = useCallback(async (force = false) => {
        const now = Date.now();
        const cacheKey = 'projects_list';
        
        // 检查缓存
        if (!force && now - lastFetchTime.current < CACHE_DURATION) {
            const cached = projectsCache.current.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        setIsLoadingProjects(true);
        
        try {
            const response = await api.projects();
            const data = await response.json();
            
            // 更新缓存
            projectsCache.current.set(cacheKey, data);
            lastFetchTime.current = now;
            
            // 只在数据真正变化时更新状态
            setProjects(prevProjects => {
                if (compareProjects(prevProjects, data)) {
                    return prevProjects; // 返回相同引用避免重渲染
                }
                return data;
            });
            
            return data;
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        } finally {
            setIsLoadingProjects(false);
        }
    }, [compareProjects]);

    // 优化的项目选择函数
    const selectProject = useCallback((project) => {
        setSelectedProject(prevSelected => {
            // 避免选择相同项目时的重渲染
            if (prevSelected?.name === project?.name) {
                return prevSelected;
            }
            return project;
        });
    }, []);

    // 优化的会话选择函数
    const selectSession = useCallback((session) => {
        setSelectedSession(prevSelected => {
            if (prevSelected?.id === session?.id) {
                return prevSelected;
            }
            return session;
        });
    }, []);

    // 批量更新项目状态
    const updateProjectsInBatch = useCallback((updates) => {
        setProjects(prevProjects => {
            let hasChanges = false;
            const newProjects = prevProjects.map(project => {
                const update = updates.find(u => u.name === project.name);
                if (update) {
                    hasChanges = true;
                    return { ...project, ...update };
                }
                return project;
            });
            
            return hasChanges ? newProjects : prevProjects;
        });
    }, []);

    // 清理缓存函数
    const clearCache = useCallback(() => {
        projectsCache.current.clear();
        lastFetchTime.current = 0;
    }, []);

    // 计算过的属性
    const computedValues = useMemo(() => {
        const projectNames = projects.map(p => p.name);
        const sessionCounts = projects.reduce((acc, p) => {
            acc[p.name] = p.sessions?.length || 0;
            return acc;
        }, {});
        
        return {
            projectNames,
            sessionCounts,
            totalSessions: Object.values(sessionCounts).reduce((a, b) => a + b, 0)
        };
    }, [projects]);

    return {
        // State
        projects,
        selectedProject,
        selectedSession,
        isLoadingProjects,
        
        // Actions
        fetchProjects,
        selectProject,
        selectSession,
        updateProjectsInBatch,
        clearCache,
        
        // Computed values
        ...computedValues
    };
};