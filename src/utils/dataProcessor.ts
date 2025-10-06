import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, subYears,addYears ,addMonths} from 'date-fns';
import { Student, EnrollmentData, ActivityData, DashboardMetrics } from '../types/Student';



export class DataProcessor {
  static filterStudentsByPeriod(
    students: Student[],
    period: 'quarter' | 'year' | 'custom',
    customMonths?: number
  ): Student[] {
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

    return students.filter(s => s.enrollmentDate >= periodStart);
  }

  static calculateDashboardMetrics(students: Student[]): DashboardMetrics {
  const threeYearsAgo = subYears(new Date(), 3);
  const recentStudents = students.filter(s => s.enrollmentDate >= threeYearsAgo);

  // Students eligible for renewal = enrolled before today - 1 year
  const eligibleForRenewal = recentStudents.filter(s => s.enrollmentDate < subYears(new Date(), 1));

  // ✅ Renewal check: has at least one renewal
  const renewedStudents = eligibleForRenewal.filter(s => s.renewalDates && s.renewalDates.length > 0);

  const renewalRate = eligibleForRenewal.length > 0 
    ? (renewedStudents.length / eligibleForRenewal.length) * 100 
    : 0;

  const multiActivityStudents = recentStudents.filter(s => s.activities.length > 1);
  const dropOffStudents = students.filter(s => s.isStrikeOff);

  const dropOffRate = students.length > 0 
    ? (dropOffStudents.length / students.length) * 100 
    : 0;

  return {
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

  // Process enrollments & renewals
  students.forEach(student => {
    // ✅ Enrollments
    const enrollmentMonthKey = format(startOfMonth(student.enrollmentDate), 'yyyy-MM');
    const enrollmentMonth = monthlyData.get(enrollmentMonthKey);
    if (enrollmentMonth && student.enrollmentDate >= startDate) {
      enrollmentMonth.newEnrollments++;
    }

    // ✅ Renewals → loop over ALL renewalDates
    if (student.renewalDates && student.renewalDates.length > 0) {
      student.renewalDates.forEach(rDate => {
        const renewalMonthKey = format(startOfMonth(rDate), 'yyyy-MM');
        const renewalMonth = monthlyData.get(renewalMonthKey);
        if (renewalMonth && rDate >= startDate) {
          renewalMonth.renewals++;
        }
      });
    }

    // ✅ Drop-offs (strike-off logic)
    if (student.isStrikeOff) {
      // If multiple renewals exist, take the last one for drop-off month
      const dropOffRef = student.renewalDates?.length
        ? student.renewalDates[student.renewalDates.length - 1]
        : student.enrollmentDate;

      const dropOffMonthKey = format(startOfMonth(dropOffRef), 'yyyy-MM');
      const dropOffMonth = monthlyData.get(dropOffMonthKey);
      if (dropOffMonth && dropOffRef >= startDate) {
        dropOffMonth.dropOffs++;
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
        activityMap.set(activity, { enrollments: 0, renewals: 0, dropOffs: 0 });
      }

      const data = activityMap.get(activity)!;
      data.enrollments++;

      // ✅ Count all renewals
      if (student.renewalDates && student.renewalDates.length > 0) {
        data.renewals += student.renewalDates.length;
      }

      if (student.isStrikeOff) {
        data.dropOffs++;
      }
    });
  });

  return Array.from(activityMap.entries())
    .map(([activity, data]) => ({
      activity,
      enrollments: data.enrollments,
      renewals: data.renewals,
      dropRate: data.enrollments > 0 
        ? Math.round((data.dropOffs / data.enrollments) * 100 * 100) / 100 
        : 0
    }))
    .sort((a, b) => b.enrollments - a.enrollments);
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

  static getRenewalRateByPeriod(
  students: Student[],
  period: 'quarter' | 'year' | 'custom',
  customMonths?: number
): number {
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

  const periodEnd = now;

  // Students whose renewal was due in this period
  const dueThisPeriod = students.filter(s => {
    if (!s.enrollmentDate) return false;

    // Renewal due date = last renewal + 1 month, or enrollment + 1 month
    const baseDate = s.renewalDates?.length 
      ? s.renewalDates[s.renewalDates.length - 1]  // ✅ last known renewal
      : s.enrollmentDate;

    const dueDate = addMonths(baseDate, 1);
    return dueDate >= periodStart && dueDate <= periodEnd && s.isActive;
  });

  // Of those, how many actually renewed in this period
  const renewedThisPeriod = dueThisPeriod.filter(s =>
    s.renewalDates?.some(r => r >= periodStart && r <= periodEnd)
  );

  return dueThisPeriod.length > 0
    ? Math.round((renewedThisPeriod.length / dueThisPeriod.length) * 100 * 100) / 100
    : 0;
}


}