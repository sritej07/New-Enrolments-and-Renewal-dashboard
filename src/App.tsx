import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BookOpen,
  BarChart3
} from 'lucide-react';
import { useStudentData } from './hooks/useStudentData';
import { DataProcessor } from './utils/dataProcessor';
import { MetricCard } from './components/MetricCard';
import { LineChart } from './components/charts/LineChart';
import { BarChart } from './components/charts/BarChart';
import { DoughnutChart } from './components/charts/DoughnutChart';
import { FilterPanel } from './components/FilterPanel';
import { ActivityTable } from './components/ActivityTable';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';

function App() {
  const { students, loading, error, refetch } = useStudentData();
  const [selectedPeriod, setSelectedPeriod] = useState<'quarter' | 'year' | 'custom'>('year');
  const [customMonths, setCustomMonths] = useState(12);

  const dashboardData = useMemo(() => {
    if (!students.length) return null;

    const metrics = DataProcessor.calculateDashboardMetrics(students);
    const monthlyData = DataProcessor.getMonthlyEnrollments(students, 12);
    const activityData = DataProcessor.getActivityEnrollments(students);
    const topActivities = DataProcessor.getTopActivities(students, 10);
    const highDropRateActivities = DataProcessor.getHighestDropRateActivities(students, 5);
    const renewalRate = DataProcessor.getRenewalRateByPeriod(
      students, 
      selectedPeriod, 
      customMonths
    );

    // Chart data
    const enrollmentChartData = {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'New Enrollments',
          data: monthlyData.map(d => d.newEnrollments),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
        },
        {
          label: 'Renewals',
          data: monthlyData.map(d => d.renewals),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.1)',
          fill: true,
        },
        {
          label: 'Drop-offs',
          data: monthlyData.map(d => d.dropOffs),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: true,
        }
      ]
    };

    const activityBarData = {
      labels: topActivities.slice(0, 8).map(a => a.activity),
      datasets: [
        {
          label: 'Enrollments',
          data: topActivities.slice(0, 8).map(a => a.enrollments),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Renewals',
          data: topActivities.slice(0, 8).map(a => a.renewals),
          backgroundColor: '#10b981',
        }
      ]
    };

    const multiActivityData = {
      labels: ['Single Activity', 'Multiple Activities'],
      datasets: [
        {
          data: [
            metrics.totalActiveStudents - metrics.multiActivityStudents,
            metrics.multiActivityStudents
          ],
          backgroundColor: ['#94a3b8', '#3b82f6'],
          borderWidth: 0,
        }
      ]
    };

    return {
      metrics,
      renewalRate,
      monthlyData,
      activityData,
      topActivities,
      highDropRateActivities,
      enrollmentChartData,
      activityBarData,
      multiActivityData
    };
  }, [students, selectedPeriod, customMonths]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error && (!dashboardData || !students.length)) {
    return <ErrorAlert message={error} onRetry={refetch} />;
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BarChart3 className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-600">No Data Available</h2>
          <p className="text-gray-500 mt-2">Please check your data source and try again.</p>
        </div>
      </div>
    );
  }

  const { 
    metrics, 
    renewalRate, 
    enrollmentChartData, 
    activityBarData, 
    multiActivityData,
    topActivities,
    highDropRateActivities
  } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      {error && <ErrorAlert message={error} />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Student Enrollment Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Track enrollments, renewals, and student activity across all programs
          </p>
        </div>

        {/* Filters */}
        <FilterPanel
          selectedPeriod={selectedPeriod}
          customMonths={customMonths}
          onPeriodChange={setSelectedPeriod}
          onCustomMonthsChange={setCustomMonths}
          onRefresh={refetch}
        />

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <MetricCard
            title="Active Students"
            value={metrics.totalActiveStudents.toLocaleString()}
            icon={Users}
            iconColor="text-blue-600"
          />
          <MetricCard
            title="New Enrollments"
            value={metrics.totalNewEnrollments.toLocaleString()}
            icon={UserPlus}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Total Renewals"
            value={metrics.totalRenewals.toLocaleString()}
            icon={RefreshCw}
            iconColor="text-purple-600"
          />
          <MetricCard
            title="Renewal Rate"
            value={`${renewalRate}%`}
            icon={TrendingUp}
            iconColor="text-indigo-600"
          />
          <MetricCard
            title="Drop-off Rate"
            value={`${metrics.dropOffRate}%`}
            icon={TrendingDown}
            iconColor="text-red-600"
          />
          <MetricCard
            title="Multi-Activity Students"
            value={metrics.multiActivityStudents.toLocaleString()}
            icon={Activity}
            iconColor="text-orange-600"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LineChart
            title="Monthly Enrollment Trends"
            data={enrollmentChartData}
          />
          <DoughnutChart
            title="Students by Activity Count"
            data={multiActivityData}
          />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 mb-8">
          <BarChart
            title="Enrollments and Renewals by Activity"
            data={activityBarData}
            height={350}
          />
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityTable
            title="Top Activities by Enrollment"
            activities={topActivities}
          />
          <ActivityTable
            title="Activities with Highest Drop Rates"
            activities={highDropRateActivities}
            showDropRate={true}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Dashboard powered by Google Sheets API • Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export default App;