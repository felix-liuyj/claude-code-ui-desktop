import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

const LoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('请输入用户名和密码');
            return;
        }

        setIsLoading(true);

        const result = await login(username, password);

        if (!result.success) {
            setError(result.error);
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card rounded-lg shadow-lg border border-border p-8 space-y-6">
                    {/* Logo and Title */ }
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                                <MessageSquare className="w-8 h-8 text-primary-foreground"/>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">欢迎回来</h1>
                        <p className="text-muted-foreground mt-2">
                            登录您的 Claude Code UI 账户
                        </p>
                    </div>

                    {/* Login Form */ }
                    <form onSubmit={ handleSubmit } className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                                用户名
                            </label>
                            <input
                                type="text"
                                id="username"
                                value={ username }
                                onChange={ (e) => setUsername(e.target.value) }
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="输入您的用户名"
                                required
                                disabled={ isLoading }
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                                密码
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={ password }
                                onChange={ (e) => setPassword(e.target.value) }
                                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="输入您的密码"
                                required
                                disabled={ isLoading }
                            />
                        </div>

                        { error && (
                            <div
                                className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
                                <p className="text-sm text-red-700 dark:text-red-400">{ error }</p>
                            </div>
                        ) }

                        <button
                            type="submit"
                            disabled={ isLoading }
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                        >
                            { isLoading ? '登录中...' : '登录' }
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                            输入您的凭据以访问 Claude Code UI
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;