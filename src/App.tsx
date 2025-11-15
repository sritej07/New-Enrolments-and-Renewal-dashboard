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
import { MetricCard } from './MetricCard';
import { ClickableMetricCard } from './ClickableMetricCard';
import { LineChart } from './components/charts/LineChart';
import { BarChart } from './components/charts/BarChart';
import { DoughnutChart } from './components/charts/DoughnutChart';
import { DateRangeFilter } from './components/DateRangeFilter';
import { UnifiedTrendChart } from './components/charts/UnifiedTrendChart';
import { ActivityTable } from './components/ActivityTable';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorAlert } from './components/ErrorAlert';
import { UnifiedStudentModal } from './components/UnifiedStudentModal';
import { DateRange } from './types/UnifiedTypes';
import { subYears } from 'date-fns';
import { RenewalModal } from './components/RenewalModal';
import { CourseCategoryFilter } from './components/CourseCategoryFilter';
import { RenewalRecord ,StudentWithLTV,} from './types/Student';

function App() {
  const { students, renewalRecords, multipleActivitiesStudents, loading, error, refetch } = useStudentData();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subYears(new Date(), 3),
    endDate: new Date()
  });
  const [selectedCourseCategories, setSelectedCourseCategories] = useState<string[]>([]);
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

  const allCourseCategories = useMemo(() => {
    if (!students.length && !renewalRecords.length) return [];
    const categories = new Set<string>();
    students.forEach(s => {
      s.courseCategories.forEach(c => categories.add(c));
    });
    renewalRecords.forEach(r => {
      r.courseCategories.forEach(c => categories.add(c));
    });

    return Array.from(categories).sort();
  }, [students, renewalRecords]);

  const filteredData = useMemo(() => {
    const hasCategoryFilter = selectedCourseCategories.length > 0;

    const filteredStudents = hasCategoryFilter
      ? students.filter(s => s.courseCategories.some(c => selectedCourseCategories.includes(c)))
      : students;

    const filteredRenewalRecords = hasCategoryFilter
      ? renewalRecords.filter(r => r.courseCategories.some(c => selectedCourseCategories.includes(c)))
      : renewalRecords;

    const filteredMultipleActivitiesStudents = hasCategoryFilter
      ? multipleActivitiesStudents.filter(s => s.courseCategories.some(c => selectedCourseCategories.includes(c)))
      : multipleActivitiesStudents;

    return { filteredStudents, filteredRenewalRecords, filteredMultipleActivitiesStudents };
  }, [students, renewalRecords, multipleActivitiesStudents, selectedCourseCategories]);

  // Calculate today's metrics (independent of date filter)
  const todayMetrics = useMemo(() => {
    const { filteredStudents, filteredRenewalRecords } = filteredData;
    if (!filteredStudents.length) return null;

    return {
      todayEnrollments: UnifiedDataProcessor.getTodayEnrollments(filteredStudents),
      enrollmentsLast7Days: UnifiedDataProcessor.getEnrollmentsForLastNDays(filteredStudents, 7),
      enrollmentsLast15Days: UnifiedDataProcessor.getEnrollmentsForLastNDays(filteredStudents, 15),
      todayRenewals: UnifiedDataProcessor.getTodayRenewals(filteredRenewalRecords),
      renewalsLast7Days: UnifiedDataProcessor.getRenewalsForLastNDays(filteredRenewalRecords, 7),
      renewalsLast15Days: UnifiedDataProcessor.getRenewalsForLastNDays(filteredRenewalRecords, 15),
      currentlyActive: UnifiedDataProcessor.getCurrentlyActiveStudents(filteredStudents, filteredRenewalRecords),
      currentlyActiveMultiActivity: UnifiedDataProcessor.getCurrentlyActiveMultiActivityStudents(filteredStudents, filteredRenewalRecords)
    };
  }, [filteredData]);

  const dashboardData = useMemo(() => {
    const { filteredStudents, filteredRenewalRecords, filteredMultipleActivitiesStudents } = filteredData;
    if (!filteredStudents.length) return null;

    const metrics = UnifiedDataProcessor.calculateUnifiedMetrics(filteredStudents, filteredRenewalRecords, dateRange);
    const monthlyData = UnifiedDataProcessor.calculateMonthlyTrends(filteredStudents, filteredRenewalRecords, dateRange);
    const trendData = UnifiedDataProcessor.calculateTrendData(filteredStudents, filteredRenewalRecords,dateRange);
    const topCourseCategories = UnifiedDataProcessor.getCourseCategoryEnrollments(filteredStudents, filteredRenewalRecords, dateRange).slice(0, 13);
    const multipleStudents = UnifiedDataProcessor.getMultiActivityStudents(filteredMultipleActivitiesStudents, dateRange);
    const highChurnCourseCategories = UnifiedDataProcessor.getCourseCategoryChurnRates(filteredStudents, dateRange).slice(0, 13);

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
          label: 'Churned Students',
          data: monthlyData.map(d => d.dropped),
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          fill: true,
        }
      ]
    };

    const courseCategoryBarData = {
      labels: topCourseCategories.slice(0, 14).map(a => a.courseCategory),
      datasets: [
        {
          label: 'Enrollments',
          data: topCourseCategories.slice(0, 14).map(a => a.enrollments),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Renewals',
          data: topCourseCategories.slice(0, 14).map(a => a.renewals),
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
            metrics.newEnrollments - 2*multipleStudents.length,
            multipleStudents.length
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
      topCourseCategories,
      highChurnCourseCategories,
      multipleStudents,
      enrollmentChartData,
      courseCategoryBarData,
      multiActivityData
    };
  }, [filteredData, dateRange]);
  
  
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
    courseCategoryBarData,
    multiActivityData,
    topCourseCategories,
    highChurnCourseCategories,
    multipleStudents
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
        {/* Course Category Filter */}
        <div className="mb-8 flex items-center justify-start">
          <CourseCategoryFilter
            options={allCourseCategories}
            selected={selectedCourseCategories}
            onChange={setSelectedCourseCategories}
          />
        </div>
        {/* Today's Metrics (Independent of Date Filter) */}
        {todayMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <ClickableMetricCard
              title="Today's Enrolments"
              value={todayMetrics.todayEnrollments.length.toLocaleString()}
              icon={UserPlus}
              description="Total new student enrollments recorded today."
              iconColor="text-green-600"
              onClick={() => openModal("Today's Enrolments", todayMetrics.todayEnrollments)}
            />
            <ClickableMetricCard
              title="Last 7 Days Enrolments"
              value={todayMetrics.enrollmentsLast7Days.length.toLocaleString()}
              icon={UserPlus}
              description="Total new student enrollments recorded in the last 7 days."
              iconColor="text-green-600"
              onClick={() => openModal("Last 7 Days Enrolments", todayMetrics.enrollmentsLast7Days)}
            />
            <ClickableMetricCard
              title="Last 15 Days Enrolments"
              value={todayMetrics.enrollmentsLast15Days.length.toLocaleString()}
              icon={UserPlus}
              description="Total new student enrollments recorded in the last 15 days."
              iconColor="text-green-600"
              onClick={() => openModal("Last 15 Days Enrolments", todayMetrics.enrollmentsLast15Days)}
            />
            <ClickableMetricCard
              title="Today's Renewals"
              value={todayMetrics.todayRenewals.length.toLocaleString()}
              icon={RefreshCw}
              description="Total student renewals recorded today."
              iconColor="text-blue-600"
              onClick={() => openRenewalModal("Today's Renewals", todayMetrics.todayRenewals)}
            />
            <ClickableMetricCard
              title="Last 7 Days Renewals"
              value={todayMetrics.renewalsLast7Days.length.toLocaleString()}
              icon={RefreshCw}
              description="Total student renewals recorded in the last 7 days."
              iconColor="text-blue-600"
              onClick={() => openRenewalModal("Last 7 Days Renewals", todayMetrics.renewalsLast7Days)}
            />
            <ClickableMetricCard
              title="Last 15 Days Renewals"
              value={todayMetrics.renewalsLast15Days.length.toLocaleString()}
              icon={RefreshCw}
              description="Total student renewals recorded in the last 15 days."
              iconColor="text-blue-600"
              onClick={() => openRenewalModal("Last 15 Days Renewals", todayMetrics.renewalsLast15Days)}
            />
            <ClickableMetricCard
              title="Currently Active Students"
              value={todayMetrics.currentlyActive.length.toLocaleString()}
              icon={Users}
              description="Total number of students with an active subscription or within their grace period as of today."
              iconColor="text-purple-600"
              onClick={() => openModal('Currently Active Students', todayMetrics.currentlyActive)}
            />
            <ClickableMetricCard
              title="Currently Active Multi-Course Students"
              value={todayMetrics.currentlyActiveMultiActivity.length.toLocaleString()}
              icon={Activity}
              description="Total number of currently active students enrolled in more than one course."
              iconColor="text-indigo-600"
              onClick={() => openModal('Currently Active Multi-Activity Students', todayMetrics.currentlyActiveMultiActivity)}
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
            description="Total new student enrollments within the selected date range."
            iconColor="text-green-600"
            onClick={() => openModal('New Enrollments', UnifiedDataProcessor.getNewEnrollments(filteredData.filteredStudents, dateRange))}
          />
          <ClickableMetricCard
            title="Eligible for Renewal"
            value={metrics.eligibleStudents.toLocaleString()}
            icon={Users}
            description="Students whose subscription end date falls within the selected date range, making them eligible for renewal."
            iconColor="text-yellow-600"
            onClick={() => openRenewalModal('Eligible for Renewal', UnifiedDataProcessor.getEligibleStudents(filteredData.filteredStudents, filteredData.filteredRenewalRecords, dateRange))}
          />
          <ClickableMetricCard
            title="Renewals"
            value={metrics.renewedStudents.toLocaleString()}
            icon={RefreshCw}
            description="Total student renewals processed within the selected date range."
            iconColor="text-blue-600"
            onClick={() => openRenewalModal('Renewed Students', UnifiedDataProcessor.getRenewedStudents(filteredData.filteredRenewalRecords, dateRange))}
          />
          <ClickableMetricCard
            title="Churned Students"
            value={metrics.churnedStudents.toLocaleString()}
            icon={TrendingDown}
            description="Students whose subscription ended in the date range and did not renew within the 45-day grace period."
            iconColor="text-red-600"
            onClick={() => openModal('Churned Students', UnifiedDataProcessor.getChurnedStudents(filteredData.filteredStudents, dateRange))}
          />
          <ClickableMetricCard
            title="In Grace Period"
            value={metrics.inGraceStudents.toLocaleString()}
            icon={Clock}
            description="Students whose subscription has expired but are still within the 45-day grace period for renewal."
            iconColor="text-orange-600"
            onClick={() => openModal('In Grace Period', UnifiedDataProcessor.getInGraceStudents(filteredData.filteredStudents, dateRange))}
          />
          <ClickableMetricCard
            title="Multi-Course Students"
            value={multipleStudents.length.toLocaleString()}
            icon={Activity}
            description="Students who enrolled in more than one course within the selected date range."
            iconColor="text-purple-600"
            onClick={() => openModal('Multi-Activity Students', multipleStudents)}
          />
        </div>

        {/* Percentage Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Renewal %"
            value={`${metrics.renewalPercentage}%`}
            description="(Renewals ÷ Eligible for Renewal) × 100"
            icon={TrendingUp}
            iconColor="text-green-600"
          />
          <MetricCard
            title="Churn %"
            value={`${metrics.churnPercentage}%`}
            description="(Churned Students ÷ Active Students at Start) × 100"
            icon={TrendingDown}
            iconColor="text-red-600"
          />
          <MetricCard
            title="Retention %"
            value={`${metrics.retentionPercentage}%`}
            description="100% - Churn %"
            icon={RefreshCw}
            iconColor="text-blue-600"
          />
          <MetricCard
            title="Net Growth %"
            value={`${metrics.netGrowthPercentage}%`}
            description="((End Students - Start Students) ÷ Start Students) × 100"
            icon={TrendingUp}
            iconColor="text-purple-600"
          />
        </div>

        {/* LTV Metric */}
        {/* <div className="grid grid-cols-1 gap-6 mb-8">
          <MetricCard
            title="Total Lifetime Value (LTV)"
            value={`₹${metrics.lifetimeValue.toLocaleString('en-IN')}`}
            icon={IndianRupee}
            iconColor="text-green-600"
          />
        </div> */}

        {/* Trend Over Time */}
        {/* <div className="mb-8">
          <UnifiedTrendChart data={trendData} />
        </div> */}

        {/* Enrollment Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LineChart
            title="Monthly Trends"
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
            title="Enrollments and Renewals by Course Category"
            data={courseCategoryBarData}
            height={350}
          />
        </div>

        {/* Activity Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ActivityTable
            title="Top Course Categories by Enrollment"
            activities={topCourseCategories.map(c => ({ ...c, activity: c.courseCategory }))}
            onActivityClick={(category) => openModal(`Enrolled Students in ${category}`, UnifiedDataProcessor.getEnrolledStudentsByCourseCategory(filteredData.filteredStudents, category, dateRange))}
          />
          <ActivityTable
            title="Course Categories with Highest Churned students"
            activities={highChurnCourseCategories.map(c => ({ ...c, activity: c.courseCategory }))}
            showChurnedStudents={true}
            onActivityClick={(category) => openModal(`Churned Students in ${category}`, UnifiedDataProcessor.getChurnedStudentsByCourseCategory(filteredData.filteredStudents, category, dateRange))}
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