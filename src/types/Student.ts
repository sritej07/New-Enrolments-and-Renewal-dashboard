export interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  activities: string[];
  activity?: string; // Single activity for this enrollment row
  enrollmentDate: Date;
  renewalDates: Date[]; 
  endDate?: Date;
  enrolledEndDate?: Date; // New field to track original end date
  enrolledFees?: number; // New field to track original fees
  isActive: boolean;
  isStrikeOff: boolean;
  fees?: number;
  notes?: string;
  package?: string;
  source?: string; // Track data source (FormResponses1, RazorpayEnrollments, etc.)
}
export interface RenewalRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  activities: string;
  renewalDate: Date | undefined;
  endDate?: Date;
  package?: string;
  fees: number;
  source: string;
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
  // totalActiveStudents: number;
  totalNewEnrollments: number;
  totalRenewals: number;
  overallRenewalRate: number;
  dropOffRate: number;
  multiActivityStudents: number;
}