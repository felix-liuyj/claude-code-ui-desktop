import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * 安全的Recharts组件包装器
 * 处理React 18兼容性问题
 */
export class SafeRechartsWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        // 捕获React兼容性相关错误
        if (error.message && (
            error.message.includes('AsyncMode') ||
            error.message.includes('Cannot set properties of undefined') ||
            error.message.includes('React') ||
            error.stack?.includes('recharts')
        )) {
            return { hasError: true };
        }
        // 其他错误继续抛出
        throw error;
    }

    componentDidCatch(error, errorInfo) {
        if (error.message && (
            error.message.includes('AsyncMode') ||
            error.message.includes('Cannot set properties of undefined') ||
            error.message.includes('React') ||
            error.stack?.includes('recharts')
        )) {
            console.warn('Recharts compatibility warning (non-critical):', error.message);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            图表组件暂时不可用
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            React兼容性问题，功能不受影响
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}