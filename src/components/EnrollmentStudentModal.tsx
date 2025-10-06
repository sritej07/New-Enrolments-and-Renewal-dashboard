import React from 'react';
import { X, Mail, Phone, Calendar, Package } from 'lucide-react';
import { format } from 'date-fns';
import { Student } from '../types/Student';

interface EnrollmentStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  students: Student[];
}

export const EnrollmentStudentModal: React.FC<EnrollmentStudentModalProps> = ({
  isOpen,
  onClose,
  title,
  students
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (student: Student) => {
    if (student.isStrikeOff) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Dropped
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
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
                        <h3 className="font-medium text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-600">{student.activities.join(', ')}</p>
                      </div>
                      {getStatusBadge(student)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                          Enrolled: {format(student.enrollmentDate, 'MMM dd, yyyy')}
                        </span>
                      </div>

                      {student.renewalDates?.map((date, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <Calendar size={16} className="text-green-500" />
                          <span className="text-gray-600">
                            Renewed: {format(new Date(date), 'MMM dd, yyyy')}
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