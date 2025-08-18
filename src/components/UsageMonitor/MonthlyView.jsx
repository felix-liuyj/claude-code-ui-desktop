import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, BarChart3, RefreshCw, Download, Activity } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { apiFetch } from '../../utils/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts';
import { SafeRechartsWrapper } from '../SafeRecharts';

/**
 * 月度使用量视图组件
 */
export function MonthlyView() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [months, setMonths] = useState(6);

    // 获取月度数据
    const fetchMonthlyData = async (monthCount = months) => {
        try {
            setLoading(true);
            const response = await apiFetch(`/api/usage/monthly?months=${monthCount}`);
            const result = await response.json();
            
            if (result.success) {
                setData(result.data);
                setError(null);
            } else {
                setError(result.error || '获取数据失败');
            }
        } catch (err) {
            console.error('Error fetching monthly data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 导出数据
    const exportData = async () => {
        try {
            const response = await apiFetch(`/api/usage/export?format=csv&type=monthly&period=${months}`);
            if (response.headers.get('content-type')?.includes('text/csv')) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `claude-usage-monthly-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (err) {
            console.error('Error exporting data:', err);
        }
    };

    useEffect(() => {
        fetchMonthlyData();
    }, []);

    // 处理月数变更
    const handleMonthsChange = (newMonths) => {
        setMonths(newMonths);
        fetchMonthlyData(newMonths);
    };

    // 格式化图表数据
    const formatChartData = () => {
        if (!data?.report) return [];
        
        return data.report.reverse().map(item => ({
            month: item.month.replace('-', '年') + '月',
            tokens: item.stats.totalTokens,
            cost: item.stats.totalCost,
            sessions: item.sessionCount,
            avgDaily: Math.round(item.stats.totalTokens / 30), // 粗略估算
        }));
    };

    // 格式化饼图数据（最近3个月的对比）
    const formatPieData = () => {
        if (!data?.report || data.report.length < 2) return [];
        
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        
        return data.report.slice(0, 3).map((item, index) => ({
            name: item.month.replace('-', '年') + '月',
            value: item.stats.totalTokens,
            cost: item.stats.totalCost,
            color: colors[index % colors.length]
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
                                    ? `$${entry.value.toFixed(2)}` 
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
                    <span>加载月度数据...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <Button onClick={() => fetchMonthlyData()} className="mt-3" size="sm">
                    重试
                </Button>
            </div>
        );
    }

    if (!data?.report || data.report.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>暂无月度使用数据</p>
            </div>
        );
    }

    const chartData = formatChartData();
    const pieData = formatPieData();
    const { summary } = data;

    return (
        <div className="space-y-6">
            {/* 头部控制栏 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">月度使用统计</span>
                    <Badge variant="outline">
                        {data.totalMonths} 月数据
                    </Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                    <select
                        value={months}
                        onChange={(e) => handleMonthsChange(parseInt(e.target.value))}
                        className="text-sm border rounded px-2 py-1 dark:bg-gray-800"
                    >
                        <option value={3}>3 个月</option>
                        <option value={6}>6 个月</option>
                        <option value={12}>12 个月</option>
                        <option value={24}>24 个月</option>
                    </select>
                    
                    <Button onClick={exportData} size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        导出
                    </Button>
                    
                    <Button onClick={() => fetchMonthlyData()} size="sm" variant="outline">
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
                            summary.growth.tokensGrowth > 0 ? 'bg-green-100 dark:bg-green-900' : 
                            summary.growth.tokensGrowth < 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                            {summary.growth.tokensGrowth > 0 ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : summary.growth.tokensGrowth < 0 ? (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                            ) : (
                                <Activity className="w-5 h-5 text-gray-600" />
                            )}
                        </div>
                    </div>
                    {summary.growth.tokensGrowth !== 0 && (
                        <p className={`text-xs mt-1 ${
                            summary.growth.tokensGrowth > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                            {summary.growth.tokensGrowth > 0 ? '+' : ''}{summary.growth.tokensGrowth.toFixed(1)}% 月增长
                        </p>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">总成本</p>
                            <p className="text-2xl font-bold">${summary.totalCost.toFixed(2)}</p>
                        </div>
                    </div>
                    {summary.growth.costGrowth !== 0 && (
                        <p className={`text-xs mt-1 ${
                            summary.growth.costGrowth > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                            {summary.growth.costGrowth > 0 ? '+' : ''}{summary.growth.costGrowth.toFixed(1)}% 月增长
                        </p>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">月均令牌</p>
                            <p className="text-2xl font-bold">{Math.round(summary.averageTokensPerMonth).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">月均成本</p>
                            <p className="text-2xl font-bold">${summary.averageCostPerMonth.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 图表区域 */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* 月度使用量柱状图 */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
                    <h3 className="font-semibold mb-4">月度使用量趋势</h3>
                    <div className="h-80">
                        <SafeRechartsWrapper>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="tokens" fill="#3b82f6" name="令牌数" />
                                </BarChart>
                            </ResponsiveContainer>
                        </SafeRechartsWrapper>
                    </div>
                </div>

                {/* 使用量分布饼图 */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
                    <h3 className="font-semibold mb-4">最近月份使用量分布</h3>
                    <div className="h-80">
                        <SafeRechartsWrapper>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={[(value) => [value.toLocaleString(), '令牌数']]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </SafeRechartsWrapper>
                    </div>
                </div>
            </div>

            {/* 成本趋势图 */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border">
                <h3 className="font-semibold mb-4">月度成本趋势</h3>
                <div className="h-60">
                    <SafeRechartsWrapper>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Line 
                                    type="monotone" 
                                    dataKey="cost" 
                                    stroke="#10b981" 
                                    name="成本"
                                    strokeWidth={3}
                                    dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </SafeRechartsWrapper>
                </div>
            </div>

            {/* 峰值月份信息 */}
            {summary.peakMonth && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200">
                    <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">使用峰值月份</h3>
                    <p className="text-purple-600 dark:text-purple-300">
                        <strong>{summary.peakMonth.month.replace('-', '年')}月</strong> - 
                        {summary.peakMonth.stats.totalTokens.toLocaleString()} 令牌, 
                        ${summary.peakMonth.stats.totalCost.toFixed(2)} 成本, 
                        {summary.peakMonth.sessionCount} 个会话
                    </p>
                </div>
            )}

            {/* 详细月份表格 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
                <div className="p-4 border-b bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold">详细月度数据</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left">月份</th>
                                <th className="px-4 py-3 text-right">令牌数</th>
                                <th className="px-4 py-3 text-right">成本</th>
                                <th className="px-4 py-3 text-right">会话数</th>
                                <th className="px-4 py-3 text-right">日均令牌</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.report.map((item, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                                    <td className="px-4 py-3 font-medium">
                                        {item.month.replace('-', '年')}月
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {item.stats.totalTokens.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        ${item.stats.totalCost.toFixed(4)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {item.sessionCount}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                                        {Math.round(item.stats.totalTokens / 30).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}