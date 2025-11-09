import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  DollarSign,
  IndianRupee
} from 'lucide-react';
import { useStudentData } from './hooks/useStudentData';
import { UnifiedDataProcessor } from './utils/unifiedDataProcessor';
import { MetricCard } from './components/MetricCard';
import { ClickableMetricCard } from './components/ClickableMetricCard';
import { LineChart } from './components/charts/LineChart';
import { BarChart } from './components/charts/BarChart';
import { DoughnutChart } from './components/charts/DoughnutChart';
import { DateRangeFilter } from './components/DateRangeFilter';
import { UnifiedTrendChart } from './components/charts/UnifiedTrendChart';
import { ActivityTable } from './components/ActivityTable';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { UnifiedStudentModal } from './components/UnifiedStudentModal';
import { DateRange, StudentWithLTV } from './types/UnifiedTypes';
import { subYears } from 'date-fns';
import { RenewalModal } from './components/RenewalModal';
import { RenewalRecord } from './types/Student';

function App() {
  const { students, renewalRecords, loading, error, refetch } = useStudentData();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subYears(new Date(), 3),
    endDate: new Date()
  });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    students: StudentWithLTV[];
  }>({
    isOpen: false,
    title: '',
    students: []
  });

  const [renewalModalState, setRenewalModalState] = useState<{
    isOpen: boolean;
    title: string;
    students: RenewalRecord[];
  }>({
    isOpen: false,
    title: '',
    students: []
  });

  // Calculate today's metrics (independent of date filter)
  const todayMetrics = useMemo(() => {
    if (!students.length) return null;

    return {
      todayEnrollments: UnifiedDataProcessor.getTodayEnrollments(students),
      todayRenewals: UnifiedDataProcessor.getTodayRenewals(students),
      currentlyActive: UnifiedDataProcessor.getCurrentlyActiveStudents(students)
    };
  }, [students]);

  const dashboardData = useMemo(() => {
    if (!students.length) return null;

    const metrics = UnifiedDataProcessor.calculateUnifiedMetrics(students, renewalRecords, dateRange);
    const monthlyData = UnifiedDataProcessor.calculateMonthlyTrends(students, 12);
    const trendData = UnifiedDataProcessor.calculateTrendData(students, 12);
    const topActivities = UnifiedDataProcessor.getActivityEnrollments(students).slice(0, 10);
    const highChurnActivities = UnifiedDataProcessor.getActivityChurnRates(students).slice(0, 5);

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
          label: 'Dropped',
          data: monthlyData.map(d => d.dropped),
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
          borderColor: '#16a34a',
          backgroundColor: '#10b981',
        }
      ]
    };

    const multiActivityData = {
      labels: ['Single Activity', 'Multiple Activities'],
      datasets: [
        {
          data: [
            metrics.newEnrollments - metrics.multiActivityStudents,
            metrics.multiActivityStudents
          ],
          backgroundColor: ['#94a3b8', '#3b82f6'],
          borderWidth: 0,
        }
      ]
    };

    return {
      metrics,
      monthlyData,
      trendData,
      topActivities,
      highChurnActivities,
      enrollmentChartData,
      activityBarData,
      multiActivityData
    };
  }, [students, dateRange]);

  const openModal = (title: string, studentList: StudentWithLTV[]) => {
    setModalState({
      isOpen: true,
      title,
      students: studentList
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      students: []
    });
  };
  const openRenewalModal = (title: string, studentList: RenewalRecord[]) => {
    setRenewalModalState({
      isOpen: true,
      title,
      students: studentList
    });
  };
  const closeRenewalModal = () => {
    setRenewalModalState({
      isOpen: false,
      title: '',
      students: []
    });
  }

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
          <Activity className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-600">No Data Available</h2>
          <p className="text-gray-500 mt-2">Please check your data source and try again.</p>
        </div>
      </div>
    );
  }

  const {
    metrics,
    trendData,
    enrollmentChartData,
    activityBarData,
    multiActivityData,
    topActivities,
    highChurnActivities
  } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      {error && <ErrorAlert message={error} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Unified Student Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Comprehensive view of enrollments, renewals, churn, and student lifecycle metrics
            </p>
          </div>
        </div>

        {/* Today's Metrics (Independent of Date Filter) */}
        {todayMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <ClickableMetricCard
              title="Today's Enrolments"
              value={todayMetrics.todayEnrollments.length.toLocaleString()}
              icon={UserPlus}
              iconColor="text-green-600"
              onClick={() => openModal("Today's Enrolments", todayMetrics.todayEnrollments)}
            />
            <ClickableMetricCard
              title="Today's Renewals"
              value={todayMetrics.todayRenewals.length.toLocaleString()}
              icon={RefreshCw}
              iconColor="text-blue-600"
              onClick={() => openModal("Today's Renewals", todayMetrics.todayRenewals)}
            />
            <ClickableMetricCard
              title="Currently Active Students"
              value={todayMetrics.currentlyActive.length.toLocaleString()}
              icon={Users}
              iconColor="text-purple-600"
              onClick={() => openModal('Currently Active Students', todayMetrics.currentlyActive)}
            />
          </div>
        )}

        {/* Date Range Filter */}
        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={refetch}
        />

        {/* Primary Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <ClickableMetricCard
            title="New Enrollments"
            value={metrics.newEnrollments.toLocaleString()}
            icon={UserPlus}
            iconColor="text-green-600"
            onClick={() => openModal('New Enrollments', UnifiedDataProcessor.getNewEnrollments(students, dateRange))}
          />
          {/* <ClickableMetricCard
            title="Eligible Renewals"
            value={metrics.eligibleStudents.toLocaleString()}
            icon={Users}
            iconColor="text-yellow-600"
            // onClick={() => openModal('Eligible Students', UnifiedDataProcessor.getEligibleStudents(students, dateRange))}
          /> */}
          <ClickableMetricCard
            title="Renewals"
            value={metrics.renewedStudents.toLocaleString()}
            icon={RefreshCw}
            iconColor="text-blue-600"
            onClick={() => openRenewalModal('Renewed Students', UnifiedDataProcessor.getRenewedStudents(renewalRecords, dateRange))}
          />
          <ClickableMetricCard
            title="Churned Students"
            value={metrics.churnedStudents.toLocaleString()}
            icon={TrendingDown}
            iconColor="text-red-600"
            onClick={() => openModal('Churned Students', UnifiedDataProcessor.getChurnedStudents(students, dateRange))}
          />
          <ClickableMetricCard
            title="In Grace Period"
            value={metrics.inGraceStudents.toLocaleString()}
            icon={Clock}
            iconColor="text-orange-600"
            onClick={() => openModal('In Grace Period', UnifiedDataProcessor.getInGraceStudents(students, dateRange))}
          />
          <ClickableMetricCard
            title="Multi-Activity Students"
            value={metrics.multiActivityStudents.toLocaleString()}
            icon={Activity}
            iconColor="text-purple-600"
            onClick={() => openModal('Multi-Activity Students', UnifiedDataProcessor.getMultiActivityStudents(students, dateRange))}
          />
        </div>

        {/* Percentage Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Renewal %"
            value={`${metrics.renewalPercentage}%`}
            icon={TrendingUp}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Churn %"
            value={`${metrics.churnPercentage}%`}
            icon={TrendingDown}
            iconColor="text-red-600"
          />
          <MetricCard
            title="Retention %"
            value={`${metrics.retentionPercentage}%`}
            icon={RefreshCw}
            iconColor="text-blue-600"
          />
          <MetricCard
            title="Net Growth %"
            value={`${metrics.netGrowthPercentage}%`}
            icon={TrendingUp}
            iconColor="text-purple-600"
          />
        </div>

        {/* LTV Metric */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <MetricCard
            title="Total Lifetime Value (LTV)"
            value={`₹${metrics.lifetimeValue.toLocaleString('en-IN')}`}
            icon={IndianRupee}
            iconColor="text-green-600"
          />
        </div>

        {/* Trend Over Time */}
        {/* <div className="mb-8">
          <UnifiedTrendChart data={trendData} />
        </div> */}

        {/* Enrollment Trends */}
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

        {/* Activity-Based Charts */}
        <div className="grid grid-cols-1 mb-8">
          <BarChart
            title="Enrollments and Renewals by Activity"
            data={activityBarData}
            height={350}
          />
        </div>

        {/* Activity Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityTable
            title="Top Activities by Enrollment"
            activities={topActivities}
            onActivityClick={(activity) => openModal(`Students in ${activity}`, UnifiedDataProcessor.getStudentsByActivity(students, activity))}
          />
          <ActivityTable
            title="Activities with Highest Churn Rates"
            activities={highChurnActivities}
            showDropRate={true}
            showActiveStudents={true}
            onActivityClick={(activity) => openModal(`Students in ${activity}`, UnifiedDataProcessor.getStudentsByActivity(students, activity))}
          />
        </div>

        {/* Student Modal */}
        <UnifiedStudentModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          title={modalState.title}
          students={modalState.students}
        />
        <RenewalModal
          isOpen={renewalModalState.isOpen}
          onClose={closeRenewalModal}
          title={renewalModalState.title}
          students={renewalModalState.students}
        />

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Dashboard powered by Google Sheets API • Last updated: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}



export default App;