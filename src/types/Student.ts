export interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  activities: string[];
  enrollmentDate: Date;
  lastRenewalDate?: Date;
  isActive: boolean;
  isStrikeOff: boolean;
  fees?: number;
  notes?: string;
}

export interface EnrollmentData {
  month: string;
  newEnrollments: number;
  renewals: number;
  dropOffs: number;
}

export interface ActivityData {
  activity: string;
  enrollments: number;
  renewals: number;
  dropRate: number;
}

export interface DashboardMetrics {
  totalActiveStudents: number;
  totalNewEnrollments: number;
  totalRenewals: number;
  overallRenewalRate: number;
  dropOffRate: number;
  multiActivityStudents: number;
}