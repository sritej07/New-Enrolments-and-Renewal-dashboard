export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface MonthlyMetrics {
  month: string;
  date: Date;
  startOfMonth: number;
  newEnrollments: number;
  dropped: number;
  endOfMonth: number;
  churnRate: number;
  retentionRate: number;
  netGrowthRate: number;
  renewalRate: number;
}

export interface UnifiedMetrics {
  newEnrollments: number;
  eligibleStudents: number;
  renewedStudents: number;
  churnedStudents: number;
  inGraceStudents: number;
  multiActivityStudents: number;
  renewalPercentage: number;
  churnPercentage: number;
  retentionPercentage: number;
  netGrowthPercentage: number;
  lifetimeValue: number;
}
export interface Student {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  activities: string[];
  enrollmentDate: Date;
  renewalDates: Date[]; 
  endDate?: Date;
  isActive: boolean;
  isStrikeOff: boolean;
  fees?: number;
  notes?: string;
  package?: string;
}
export interface StudentWithLTV extends Student {
  lifetimeValue: number;
  studentId?: string;
}

export interface TrendData {
  month: string;
  renewalRate: number;
  churnRate: number;
  retentionRate: number;
  netGrowthRate: number;
}