import React, { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { RenewalKPICard } from './RenewalKPICard';
import { StudentListModal } from './StudentListModal';
import { calculateRenewalStats, parseStudentRenewalData } from '../utils/renewalCalculations';
import { RawStudentData, StudentRenewalData } from '../types/RenewalTypes';

interface RenewalDashboardProps {
  rawStudentData: RawStudentData[];
  onRefresh?: () => void;
}

export const RenewalDashboard: React.FC<RenewalDashboardProps> = ({
  rawStudentData,
  onRefresh
}) => {
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
    const parsedData = parseStudentRenewalData(rawStudentData);
    return calculateRenewalStats(parsedData);
  }, [rawStudentData]);

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
          count={renewalStats.renewed - renewalStats.churned}
          total={renewalStats.totalEligible}
          icon={Users}
          iconColor="text-blue-600"
          trend={renewalStats.netRetention > 0 ? 'positive' : renewalStats.netRetention < 0 ? 'negative' : 'neutral'}
          onClick={() => openModal('In Grace Period', renewalStats.inGraceStudents)}
        />
      </div>

      {/* Business Rules Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Business Rules Applied</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Lifetime packages (containing "LTV") are excluded from renewal calculations</li>
          <li>• Package duration is extracted from package name (e.g., "12 weeks" → 12 weeks)</li>
          <li>• Grace period is 45 days after package expiration</li>
          <li>• Students are considered renewed if renewal date is within grace period</li>
          <li>• Students are churned if no renewal within grace period</li>
        </ul>
      </div>

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