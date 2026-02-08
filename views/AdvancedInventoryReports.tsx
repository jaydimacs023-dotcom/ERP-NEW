import React, { useState, useMemo } from 'react';
import { 
  StockItem, InventoryLevel, InventoryTransaction, 
  JournalLine, AccountClass 
} from '../types';
import {
  InventoryReportingService,
  StockAgingData,
  ValuationData,
  MovementTrendData,
  VarianceData,
  ABCAnalysisData,
} from '../services/InventoryReportingService';
import { DataExportService } from '../services/DataExportService';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Package, Zap, Users, TrendingDown,
  Clock, DollarSign, Activity, CheckCircle, Download
} from 'lucide-react';

interface AdvancedInventoryReportsProps {
  items: StockItem[];
  levels: InventoryLevel[];
  transactions: InventoryTransaction[];
  lines: JournalLine[];
  currency: string;
}

const AdvancedInventoryReports: React.FC<AdvancedInventoryReportsProps> = ({
  items,
  levels,
  transactions,
  lines,
  currency
}) => {
  const [activeTab, setActiveTab] = useState<'aging' | 'valuation' | 'trends' | 'variance' | 'abc' | 'metrics'>('aging');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'quantity' | 'days'>('value');

  // Generate reports
  const agingReport = useMemo(() => InventoryReportingService.getStockAging(items, levels, transactions), [items, levels, transactions]);
  const valuationReport = useMemo(() => InventoryReportingService.getValuationComparison(items, levels, transactions), [items, levels, transactions]);
  const trendsReport = useMemo(() => InventoryReportingService.getMovementTrends(items, transactions, 12), [items, transactions]);
  const varianceReport = useMemo(() => InventoryReportingService.getVarianceAnalysis(items, levels, lines), [items, levels, lines]);
  const abcReport = useMemo(() => InventoryReportingService.getABCAnalysis(items, transactions), [items, transactions]);
  const lowStockReport = useMemo(() => InventoryReportingService.getLowStockItems(items, levels), [items, levels]);
  const metricsReport = useMemo(() => InventoryReportingService.getInventoryMetrics(items, levels, transactions), [items, levels, transactions]);

  // Sorting helpers
  const sortedAging = [...agingReport].sort((a, b) => {
    switch (sortBy) {
      case 'value': return b.value - a.value;
      case 'days': return b.daysInStock - a.daysInStock;
      case 'quantity': return b.currentQuantity - a.currentQuantity;
      default: return a.itemCode.localeCompare(b.itemCode);
    }
  });

  const sortedVariance = [...varianceReport].sort((a, b) => {
    const aSev = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const bSev = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return bSev[b.severity] - aSev[a.severity];
  });

  // Chart data
  const agingByCategory = agingReport.reduce((acc: Record<string, number>, item) => {
    acc[item.ageCategory] = (acc[item.ageCategory] || 0) + item.value;
    return acc;
  }, {});

  const agingChartData = Object.entries(agingByCategory).map(([category, value]) => ({
    name: category,
    value: value as number,
  }));

  const varianceBySeverity = varianceReport.reduce((acc: Record<string, number>, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + item.varianceValue;
    return acc;
  }, {});

  const varianceChartData = Object.entries(varianceBySeverity).map(([severity, value]) => ({
    name: severity,
    value: value as number,
  }));

  const abcChartData = abcReport.reduce((acc: Record<string, number>, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.annualConsumptionValue;
    return acc;
  }, {});

  const abcPieData = Object.entries(abcChartData).map(([category, value]) => ({
    name: `Category ${category}`,
    value: value as number,
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
  const SEVERITY_COLORS = { Critical: '#EF4444', High: '#F97316', Medium: '#FBBF24', Low: '#86EFAC' };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Advanced Inventory Analytics</h2>
        <p className="text-sm text-slate-500 font-normal italic">Real-time stock valuation, aging, trends, and variance analysis.</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Inventory Value</p>
              <p className="text-xl font-bold text-slate-900">{currency} {metricsReport.totalInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <DollarSign size={28} className="text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Items in Stock</p>
              <p className="text-xl font-bold text-slate-900">{metricsReport.activeItems} / {metricsReport.itemCount}</p>
            </div>
            <Package size={28} className="text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Turnover Ratio</p>
              <p className="text-xl font-bold text-slate-900">{metricsReport.inventoryTurnover.toFixed(2)}x/yr</p>
            </div>
            <Activity size={28} className="text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">DIO (Days)</p>
              <p className="text-xl font-bold text-slate-900">{Math.round(metricsReport.daysInventoryOutstanding)}</p>
            </div>
            <Clock size={28} className="text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Annual Carry Cost</p>
              <p className="text-xl font-bold text-slate-900">{currency} {metricsReport.annualCarryingCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <TrendingDown size={28} className="text-red-500" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white rounded-xl shadow p-2 overflow-x-auto">
        {[
          { id: 'aging', label: 'Stock Aging', icon: <Clock size={16} /> },
          { id: 'valuation', label: 'Valuation Methods', icon: <DollarSign size={16} /> },
          { id: 'trends', label: 'Movement Trends', icon: <TrendingUp size={16} /> },
          { id: 'variance', label: 'Variance Analysis', icon: <AlertTriangle size={16} /> },
          { id: 'abc', label: 'ABC Analysis', icon: <Zap size={16} /> },
          { id: 'metrics', label: 'Inventory Health', icon: <Activity size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Stock Age Distribution</h2>
              <button
                onClick={() => {
                  const exportData = sortedAging.map(item => ({
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantity: item.currentQuantity,
                    daysInStock: item.daysInStock,
                    value: item.value,
                    ageCategory: item.ageCategory
                  }));
                  DataExportService.exportAgingReport(exportData);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={agingChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${(entry.value / 1000).toFixed(0)}k`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${currency} ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Detailed Aging Report</h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700"
              >
                <option value="value">Sort by Value</option>
                <option value="days">Sort by Days</option>
                <option value="quantity">Sort by Quantity</option>
                <option value="name">Sort by Code</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Item Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Quantity</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Days in Stock</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Value</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedAging.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                      <td className="px-4 py-3 text-slate-700">{item.itemName}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.currentQuantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.daysInStock}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{currency} {item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.ageCategory === 'Fresh' ? 'bg-green-100 text-green-700' :
                          item.ageCategory === 'Active' ? 'bg-teal-100 text-teal-700' :
                          item.ageCategory === 'Slow' ? 'bg-amber-100 text-teal-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.ageCategory}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'valuation' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Valuation Method Comparison</h2>
              <button
                onClick={() => {
                  const exportData = valuationReport.map(item => ({
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    fifoValue: item.fifoValue,
                    lifoValue: item.lifoValue,
                    wacValue: item.weightedAvgValue,
                    variance: item.fifoValue - item.lifoValue
                  }));
                  DataExportService.exportValuationComparison(exportData);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Item Code</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">FIFO Value</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">LIFO Value</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">WAC Value</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Current Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {valuationReport.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-teal-600 font-semibold">{currency} {item.fifoValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-semibold">{currency} {item.lifoValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-semibold">{currency} {item.weightedAvgValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{currency} {item.currentCostPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">12-Month Movement Trends</h2>
              <button
                onClick={() => {
                  const exportData = trendsReport.map(item => ({
                    itemName: item.itemCode,
                    period: item.period,
                    quantity: item.quantity,
                    value: item.value,
                    trend: item.trend
                  }));
                  DataExportService.exportMovementTrends(exportData);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={trendsReport.slice(0, 24)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inbound" fill="#10B981" name="Inbound" />
                <Bar dataKey="outbound" fill="#EF4444" name="Outbound" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'variance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Variance by Severity</h2>
              <button
                onClick={() => {
                  const exportData = varianceReport.map(item => ({
                    itemName: item.itemCode,
                    expectedQuantity: item.expectedQuantity,
                    actualQuantity: item.actualQuantity,
                    variance: item.variance,
                    variancePercent: item.variancePercent
                  }));
                  DataExportService.exportVarianceAnalysis(exportData);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={varianceChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${(entry.value / 1000).toFixed(0)}k`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {varianceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${currency} ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Detailed Variance Report</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Expected</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actual</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Variance %</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Value Impact</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedVariance.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{item.expectedQuantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.actualQuantity}</td>
                      <td className="px-4 py-3 text-right font-semibold">{item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{currency} {item.varianceValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                          item.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                          item.severity === 'Medium' ? 'bg-amber-100 text-teal-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'abc' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">ABC Classification by Annual Consumption Value</h2>
              <button
                onClick={() => {
                  const exportData = abcReport.map(item => ({
                    itemName: item.itemCode,
                    classification: item.classification,
                    annualValue: item.annualValue,
                    quantity: item.quantity,
                    valuePercentage: item.valuePercentage,
                    priority: item.priority
                  }));
                  DataExportService.exportABCAnalysis(exportData);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={abcPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry) => `${entry.name}: ${(entry.value / 1000).toFixed(0)}k`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `${currency} ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Items by Category</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Item Code</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Annual Consumption Value</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Cumulative %</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Category</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Management Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {abcReport.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{currency} {item.annualConsumptionValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.cumulativePercent.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.category === 'A' ? 'bg-teal-100 text-teal-700' :
                          item.category === 'B' ? 'bg-green-100 text-green-700' :
                          'bg-amber-100 text-teal-700'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.managementFocus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Total Items</p>
              <p className="text-2xl font-bold text-slate-900">{metricsReport.itemCount}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Active Items</p>
              <p className="text-2xl font-bold text-green-600">{metricsReport.activeItems}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Inactive Items</p>
              <p className="text-2xl font-bold text-teal-600">{metricsReport.itemCount - metricsReport.activeItems}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Inventory Turnover</p>
              <p className="text-2xl font-bold text-slate-900">{metricsReport.inventoryTurnover.toFixed(2)}x/yr</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Days Inventory Outstanding</p>
              <p className="text-2xl font-bold text-slate-900">{Math.round(metricsReport.daysInventoryOutstanding)} days</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Annual Carry Cost</p>
              <p className="text-2xl font-bold text-red-600">{currency} {(metricsReport.annualCarryingCost / 1000).toFixed(0)}k</p>
            </div>
          </div>

          {lowStockReport.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-teal-500" />
                  Low Stock Items ({lowStockReport.length})
                </h2>
                <button
                  onClick={() => {
                    const exportData = lowStockReport.map(item => ({
                      itemCode: item.itemCode,
                      itemName: item.itemName,
                      currentQty: item.currentQuantity,
                      minLevel: item.minimumLevel,
                      deficit: item.quantityBelow,
                      reorderPoint: item.reorderPoint
                    }));
                    DataExportService.exportTableData('Low_Stock_Items', exportData, 
                      ['itemCode', 'itemName', 'currentQty', 'minLevel', 'deficit', 'reorderPoint'],
                      ['Code', 'Item', 'Current Qty', 'Min Level', 'Deficit', 'Reorder Point']
                    );
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Current</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Min Level</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Deficit</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lowStockReport.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 bg-orange-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.currentQuantity}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{item.minLevel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{item.deficit}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{item.reorderQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedInventoryReports;
