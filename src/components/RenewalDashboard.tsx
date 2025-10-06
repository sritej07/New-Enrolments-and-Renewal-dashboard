import React, { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { RenewalKPICard } from './RenewalKPICard';
import { StudentListModal } from './StudentListModal';
import { calculateRenewalStats, parseStudentRenewalData } from '../utils/renewalCalculations';
import { StudentRenewalData } from '../types/RenewalTypes';
import { Student } from '../types/Student';
import { calculateTrendStats } from '../utils/renewalCalculations';
import { FilterPanel } from './FilterPanel';
import { TrendChart } from './charts/TrendChart';
import { calculateTrendStats } from '../utils/renewalCalculations';
import { FilterPanel } from './FilterPanel';
import { TrendChart } from './charts/TrendChart';


interface RenewalDashboardProps {
  StudentData: Student[];
  onRefresh?: () => void;
}

export const RenewalDashboard: React.FC<RenewalDashboardProps> = ({
  StudentData,
  onRefresh
}) => {

  const [selectedPeriod, setSelectedPeriod] = useState<'quarter' | 'year' | 'custom'>('custom');
  const [customMonths, setCustomMonths] = useState<number>(6);

  const trendStats = useMemo(() => {
    const parsedData = parseStudentRenewalData(StudentData);
    return calculateTrendStats(parsedData, selectedPeriod, customMonths);
  }, [StudentData, selectedPeriod, customMonths]);


  const [selectedPeriod, setSelectedPeriod] = useState<'quarter' | 'year' | 'custom'>('custom');
  const [customMonths, setCustomMonths] = useState<number>(6);

  const trendStats = useMemo(() => {
    const parsedData = parseStudentRenewalData(StudentData);
    return calculateTrendStats(parsedData, selectedPeriod, customMonths);
  }, [StudentData, selectedPeriod, customMonths]);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    students: StudentRenewalData[];
  }>({
    isOpen: false,
    title: '',
    students: []
  });


  const renewalStats = useMemo(() => {
    const parsedData = parseStudentRenewalData(StudentData);
    return calculateRenewalStats(parsedData);
  }, [StudentData]);

  const openModal = (title: string, students: StudentRenewalData[]) => {
    setModalState({
      isOpen: true,
      title,
      students
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      students: []
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Renewal Analytics</h1>
          <p className="text-gray-600 mt-1">
            Track student renewals, churn rates, and retention metrics
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      <FilterPanel
        selectedPeriod={selectedPeriod}
        customMonths={customMonths}
        onPeriodChange={setSelectedPeriod}
        onCustomMonthsChange={setCustomMonths}
        onRefresh={onRefresh ?? (() => { })}
      />
      <TrendChart data={trendStats} />

      {/* Summary Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{renewalStats.totalEligible}</div>
            <div className="text-sm text-gray-600">Eligible Students</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{renewalStats.renewed}</div>
            <div className="text-sm text-gray-600">Renewed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{renewalStats.churned}</div>
            <div className="text-sm text-gray-600">Churned</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{renewalStats.inGrace}</div>
            <div className="text-sm text-gray-600">In Grace Period</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RenewalKPICard
          title="Renewal Rate"
          percentage={renewalStats.renewalPercentage}
          count={renewalStats.renewed}
          total={renewalStats.totalEligible}
          icon={TrendingUp}
          iconColor="text-green-600"
          trend="positive"
          onClick={() => openModal('Renewed Students', renewalStats.renewedStudents)}
        />

        <RenewalKPICard
          title="Churn Rate"
          percentage={renewalStats.churnPercentage}
          count={renewalStats.churned}
          total={renewalStats.totalEligible}
          icon={TrendingDown}
          iconColor="text-red-600"
          trend="negative"
          onClick={() => openModal('Churned Students', renewalStats.churnedStudents)}
        />

        <RenewalKPICard
          title="Net Retention"
          percentage={renewalStats.netRetention}
          count={renewalStats.inGrace}
          total={renewalStats.totalEligible}
          icon={Users}
          iconColor="text-blue-600"
          trend={renewalStats.netRetention > 0 ? 'positive' : renewalStats.netRetention < 0 ? 'negative' : 'neutral'}
          onClick={() => openModal('In Grace Period', renewalStats.inGraceStudents)}
        />
      </div>
      <FilterPanel
        selectedPeriod={selectedPeriod}
        customMonths={customMonths}
        onPeriodChange={setSelectedPeriod}
        onCustomMonthsChange={setCustomMonths}
        onRefresh={onRefresh ?? (() => { })}
      />
      <TrendChart data={trendStats} />

      {/* Business Rules Info */}

      {/* Modal */}
      <StudentListModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        students={modalState.students}
      />
    </div>
  );
};