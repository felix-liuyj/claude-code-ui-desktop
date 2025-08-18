import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, BarChart3, RefreshCw, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { apiFetch } from '../../utils/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { SafeRechartsWrapper } from '../SafeRecharts';

/**
 * 每日使用量视图组件
 */
export function DailyView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [days, setDays] = useState(30);
    const [chartType, setChartType] = useState('bar'); // 'bar' 或 'line'

    // 获取每日数据
    const fetchDailyData = async (dayCount = days) => {
        try {
            setLoading(true);
            const response = await apiFetch(`/api/usage/daily?days=${dayCount}`);
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setError(null);
            } else {
                setError(result.error || '获取数据失败');
            }
        } catch (err) {
            console.error('Error fetching daily data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 导出数据
    const exportData = async () => {
        try {
            const response = await apiFetch(`/api/usage/export?format=csv&type=daily&period=${days}`);
            if (response.headers.get('content-type')?.includes('text/csv')) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `claude-usage-daily-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                const result = await response.json();
                console.error('Export failed:', result);
            }
        } catch (err) {
            console.error('Error exporting data:', err);
        }
    };

    useEffect(() => {
        fetchDailyData();
    }, []);

    // 处理天数变更
    const handleDaysChange = (newDays) => {
        setDays(newDays);
        fetchDailyData(newDays);
    };

    // 格式化图表数据
    const formatChartData = () => {
        if (!data?.report) return [];
        
        return data.report.slice(0, 20).reverse().map(item => ({
            date: new Date(item.date).toLocaleDateString('zh-CN', { 
                month: 'short', 
                day: 'numeric' 
            }),
            tokens: item.stats.totalTokens,
            cost: item.stats.totalCost,
            sessions: item.sessionCount,
            inputTokens: item.stats.totalInputTokens,
            outputTokens: item.stats.totalOutputTokens,
        }));
    };

    // 自定义 Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
                    <p className="font-semibold">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {
                                entry.dataKey === 'cost' 
                                    ? `$${entry.value.toFixed(4)}` 
                                    : entry.value.toLocaleString()
                            }
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>加载每日数据...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button onClick={() => fetchDailyData()} className="mt-3" size="sm">
                    重试
                </Button>
            </div>
        );
    }

    if (!data?.report || data.report.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>暂无每日使用数据</p>
            </div>
        );
    }

    const chartData = formatChartData();
    const { summary } = data;

    return (
        <div className="space-y-6">
            {/* 头部控制栏 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">每日使用统计</span>
                    <Badge variant="outline">
                        {data.totalDays} 天数据
                    </Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                    <select
                        value={days}
                        onChange={(e) => handleDaysChange(parseInt(e.target.value))}
                        className="text-sm border rounded px-2 py-1 dark:bg-gray-800"
                    >
                        <option value={7}>7 天</option>
                        <option value={14}>14 天</option>
                        <option value={30}>30 天</option>
                        <option value={60}>60 天</option>
                        <option value={90}>90 天</option>
                    </select>
                    
                    <Button
                        onClick={() => setChartType(chartType === 'bar' ? 'line' : 'bar')}
                        size="sm"
                        variant="outline"
                    >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        {chartType === 'bar' ? '线图' : '柱图'}
                    </Button>
                    
                    <Button onClick={exportData} size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        导出
                    </Button>
                    
                    <Button onClick={() => fetchDailyData()} size="sm" variant="outline">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* 摘要统计卡片 */}
            <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">总令牌数</p>
                            <p className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</p>
                        </div>
                        <div className={`p-2 rounded-full ${
                            summary.trends.tokensChange > 0 ? 'bg-green-100 dark:bg-green-900' : 
                            summary.trends.tokensChange < 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                            {summary.trends.tokensChange > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : summary.trends.tokensChange < 0 ? (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            ) : (
                                <BarChart3 className="w-5 h-5 text-gray-600" />
                            )}
                        </div>
                    </div>
                    {summary.trends.tokensChange !== 0 && (
                        <p className={`text-xs mt-1 ${
                            summary.trends.tokensChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {summary.trends.tokensChange > 0 ? '+' : ''}{summary.trends.tokensChange.toFixed(1)}% 相比前期
                        </p>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">总成本</p>
                            <p className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">日均令牌</p>
                            <p className="text-2xl font-bold">{Math.round(summary.averageTokensPerDay).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">日均成本</p>
                            <p className="text-2xl font-bold">${summary.averageCostPerDay.toFixed(4)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 使用量图表 */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
                <h3 className="font-semibold mb-4">使用量趋势</h3>
                <div className="h-80">
                    <SafeRechartsWrapper>
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="tokens" fill="#3b82f6" name="令牌数" />
                                </BarChart>
                            ) : (
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Line 
                                        type="monotone" 
                                        dataKey="tokens" 
                                        stroke="#3b82f6" 
                                        name="令牌数"
                                        strokeWidth={2}
                                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                    />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </SafeRechartsWrapper>
                </div>
            </div>

            {/* 成本趋势图表 */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
                <h3 className="font-semibold mb-4">成本趋势</h3>
                <div className="h-60">
                    <SafeRechartsWrapper>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Line 
                                    type="monotone" 
                                    dataKey="cost" 
                                    stroke="#10b981" 
                                    name="成本"
                                    strokeWidth={2}
                                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </SafeRechartsWrapper>
                </div>
            </div>

            {/* 峰值天数信息 */}
            {summary.peakDay && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">使用峰值</h3>
                    <p className="text-blue-600 dark:text-blue-300">
                        <strong>{summary.peakDay.date}</strong> - 
                        {summary.peakDay.stats.totalTokens.toLocaleString()} 令牌, 
                        ${summary.peakDay.stats.totalCost.toFixed(4)} 成本, 
                        {summary.peakDay.sessionCount} 个会话
                    </p>
                </div>
            )}
        </div>
    );
}