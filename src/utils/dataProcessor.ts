import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, subYears } from 'date-fns';
import { Student, EnrollmentData, ActivityData, DashboardMetrics } from '../types/Student';

export class DataProcessor {
  static calculateDashboardMetrics(students: Student[]): DashboardMetrics {
  // const activeStudents = students.filter(s => s.isActive);
  const threeYearsAgo = subYears(new Date(), 3);
  const recentStudents = students.filter(s => s.enrollmentDate >= threeYearsAgo);

  // Students eligible for renewal = enrolled before today - renewal cycle (say 1 year)
  const eligibleForRenewal = recentStudents.filter(s => s.enrollmentDate < subYears(new Date(), 1));
  const renewedStudents = eligibleForRenewal.filter(s => s.lastRenewalDate);

  const renewalRate = eligibleForRenewal.length > 0 
    ? (renewedStudents.length / eligibleForRenewal.length) * 100 
    : 0;

  const multiActivityStudents = recentStudents.filter(s => s.activities.length > 1);
  const dropOffStudents = students.filter(s => s.isStrikeOff);
  console.log(dropOffStudents.length, students.length);
  const dropOffRate = students.length > 0 ? (dropOffStudents.length / students.length) * 100 : 0;

  return {
    // totalActiveStudents: activeStudents.length,
    totalNewEnrollments: recentStudents.length,
    totalRenewals: renewedStudents.length,
    overallRenewalRate: Math.round(renewalRate * 100) / 100,
    dropOffRate: Math.round(dropOffRate * 100) / 100,
    multiActivityStudents: multiActivityStudents.length,
  };
}


  static getMonthlyEnrollments(students: Student[], months: number = 36): EnrollmentData[] {
    const endDate = new Date();
    const startDate = subMonths(endDate, months);
    
    const monthlyData: Map<string, EnrollmentData> = new Map();

    // Initialize months
    for (let i = 0; i < months; i++) {
      const monthStart = subMonths(endDate, months - i - 1);
      const monthKey = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM yyyy');
      
      monthlyData.set(monthKey, {
        month: monthLabel,
        newEnrollments: 0,
        renewals: 0,
        dropOffs: 0
      });
    }

    // Process enrollments
    students.forEach(student => {
      const enrollmentMonth = format(startOfMonth(student.enrollmentDate), 'yyyy-MM');
      const monthData = monthlyData.get(enrollmentMonth);
      
      if (monthData && student.enrollmentDate >= startDate) {
        monthData.newEnrollments++;
      }

      // Process renewals
      if (student.lastRenewalDate) {
        const renewalMonth = format(startOfMonth(student.lastRenewalDate), 'yyyy-MM');
        const renewalData = monthlyData.get(renewalMonth);
        if (renewalData && student.lastRenewalDate >= startDate) {
          renewalData.renewals++;
        }
      }

      // Process drop-offs (we'll estimate based on last activity)
      if (student.isStrikeOff) {
        const dropOffMonth = student.lastRenewalDate || student.enrollmentDate;
        const dropOffMonthKey = format(startOfMonth(dropOffMonth), 'yyyy-MM');
        const dropOffData = monthlyData.get(dropOffMonthKey);
        if (dropOffData && dropOffMonth >= startDate) {
          dropOffData.dropOffs++;
        }
      }
    });

    return Array.from(monthlyData.values());
  }

  static getActivityEnrollments(students: Student[]): ActivityData[] {
    const activityMap: Map<string, {
      enrollments: number;
      renewals: number;
      dropOffs: number;
    }> = new Map();

    students.forEach(student => {
      student.activities.forEach(activity => {
        if (!activityMap.has(activity)) {
          activityMap.set(activity, {
            enrollments: 0,
            renewals: 0,
            dropOffs: 0
          });
        }

        const data = activityMap.get(activity)!;
        data.enrollments++;
        
        if (student.lastRenewalDate) {
          data.renewals++;
        }
        
        if (student.isStrikeOff) {
          data.dropOffs++;
        }
      });
    });

    return Array.from(activityMap.entries()).map(([activity, data]) => ({
      activity,
      enrollments: data.enrollments,
      renewals: data.renewals,
      dropRate: data.enrollments > 0 ? Math.round((data.dropOffs / data.enrollments) * 100 * 100) / 100 : 0
    })).sort((a, b) => b.enrollments - a.enrollments);
  }

  static getTopActivities(students: Student[], limit: number = 5): ActivityData[] {
    return this.getActivityEnrollments(students).slice(0, limit);
  }

  static getHighestDropRateActivities(students: Student[], limit: number = 5): ActivityData[] {
    return this.getActivityEnrollments(students)
      .filter(activity => activity.enrollments >= 5) // Only consider activities with at least 5 enrollments
      .sort((a, b) => b.dropRate - a.dropRate)
      .slice(0, limit);
  }

  static getRenewalRateByPeriod(students: Student[], period: 'quarter' | 'year' | 'custom', customMonths?: number): number {
    const now = new Date();
    let periodStart: Date;
    
    switch (period) {
      case 'quarter':
        periodStart = subMonths(now, 3);
        break;
      case 'year':
        periodStart = subYears(now, 1);
        break;
      case 'custom':
        periodStart = subMonths(now, customMonths || 6);
        break;
    }

    const studentsInPeriod = students.filter(s => 
      s.enrollmentDate <= periodStart && s.isActive
    );
    
    const renewedStudents = studentsInPeriod.filter(s => 
      s.lastRenewalDate && s.lastRenewalDate >= periodStart
    );

    return studentsInPeriod.length > 0 ? 
      Math.round((renewedStudents.length / studentsInPeriod.length) * 100 * 100) / 100 : 0;
  }
}