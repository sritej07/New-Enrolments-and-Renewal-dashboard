import React from 'react';
import { X, Mail, Phone, Calendar, Package, DollarSign, Hash, IndianRupee } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { StudentWithLTV } from '../types/UnifiedTypes';

interface UnifiedStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  students: StudentWithLTV[];
}

export const UnifiedStudentModal: React.FC<UnifiedStudentModalProps> = ({
  isOpen,
  onClose,
  title,
  students
}) => {
  if (!isOpen) return null;

  const formatDate = (date: Date | undefined | null): string => {
    if (!date || !isValid(date)) {
      return 'Invalid Date';
    }
    return format(date, 'MMM dd, yyyy');
  };

  const getStatusBadge = (student: StudentWithLTV) => {
    if (student.isStrikeOff) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Churned
        </span>
      );
    }
    
    // Check if student is churned based on grace period
    if (student.endDate) {
      const now = new Date();
      const graceEndDate = new Date(student.endDate.getTime() + (45 * 24 * 60 * 60 * 1000));
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);
      
      if (now > graceEndDate && !hasRenewal) {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Churned
          </span>
        );
      }
      
      if (now > student.endDate && now <= graceEndDate && !hasRenewal) {
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            In Grace Period
          </span>
        );
      }
    }
    
    if (student.renewalDates && student.renewalDates.length > 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Renewed
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        Active
      </span>
    );
  };

  const totalLTV = students.reduce((sum, student) => sum + student.lifetimeValue, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {students.length} students • Total LTV: ₹{totalLTV.toLocaleString('en-IN')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-120px)]">
          {students.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No students found in this category.
            </div>
          ) : (
            <div className="p-6">
              <div className="grid gap-4">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{student.name}</h3>
                          {student.studentId && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              <Hash size={12} className="mr-1" />
                              {student.studentId}
                            </span>
                          )}
                          {student.source && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {student.source}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {student.activities.join(', ')}
                          {student.courseCategory && ` (${student.courseCategory})`}
                        </p>
                      </div>
                      {/* <div>
                        {getStatusBadge(student)}
                      </div> */}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      {student.email && (
                        <div className="flex items-center space-x-2">
                          <Mail size={16} className="text-gray-400" />
                          <span className="text-gray-600">{student.email}</span>
                        </div>
                      )}

                      {student.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone size={16} className="text-gray-400" />
                          <span className="text-gray-600">{student.phone}</span>
                        </div>
                      )}

                      {student.package && (
                        <div className="flex items-center space-x-2">
                          <Package size={16} className="text-gray-400" />
                          <span className="text-gray-600">{student.package}</span>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-gray-600">
                          Enrolled: {formatDate(student.enrollmentDate)}
                        </span>
                      </div>

                      {student.endDate && (
                        <div className="flex items-center space-x-2">
                          <Calendar size={16} className="text-red-400" />
                          <span className="text-gray-600">
                            Expires: {formatDate(student.endDate)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <IndianRupee size={16} className="text-green-400" />
                        <span className="text-gray-600">
                          LTV: ₹{student.lifetimeValue.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {student.renewalDates
                        ?.slice()
                        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                        .map((date, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <Calendar size={16} className="text-green-500" />
                            <span className="text-gray-600">
                              Renewed: {formatDate(new Date(date))}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};