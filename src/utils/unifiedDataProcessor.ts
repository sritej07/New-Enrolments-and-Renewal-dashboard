import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addDays, isBefore, isAfter } from 'date-fns';
import { Student } from '../types/Student';
import { StudentWithLTV, UnifiedMetrics, MonthlyMetrics, TrendData, DateRange } from '../types/UnifiedTypes';
import { ActivityData } from '../types/Student';

export class UnifiedDataProcessor {
  static filterStudentsByDateRange(students: Student[], dateRange: DateRange): Student[] {
    return students.filter(student => 
      isWithinInterval(student.enrollmentDate, {
        start: dateRange.startDate,
        end: dateRange.endDate
      })
    );
  }

  static calculateUnifiedMetrics(students: Student[], dateRange: DateRange): UnifiedMetrics {
    const filteredStudents = this.filterStudentsByDateRange(students, dateRange);
    
    // New Enrollments
    const newEnrollments = filteredStudents.length;
    
    // Multi-Activity Students
    const multiActivityStudents = filteredStudents.filter(s => s.activities.length > 1).length;
    
    // Calculate renewal metrics
    const now = new Date();
    const eligibleStudents = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      return isBefore(student.endDate, now);
    });

    const renewedStudents = eligibleStudents.filter(student => {
      if (!student.renewalDates || student.renewalDates.length === 0) return false;
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      return student.renewalDates.some(renewalDate => 
        isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
      );
    });

    const churnedStudents = eligibleStudents.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, graceEndDate) && !hasRenewal;
    });

    const inGraceStudents = eligibleStudents.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal;
    });

    // Calculate percentages
    const renewalPercentage = eligibleStudents.length > 0 
      ? (renewedStudents.length / eligibleStudents.length) * 100 
      : 0;
    
    const churnPercentage = eligibleStudents.length > 0 
      ? (churnedStudents.length / eligibleStudents.length) * 100 
      : 0;
    
    const retentionPercentage = 100 - churnPercentage;
    
    // Calculate net growth (simplified for now)
    const netGrowthPercentage = renewalPercentage - churnPercentage;
    
    // Calculate total LTV
    const lifetimeValue = students.reduce((total, student) => {
      return total + (student.fees || 0);
    }, 0);

    return {
      newEnrollments,
      eligibleStudents: eligibleStudents.length,
      renewedStudents: renewedStudents.length,
      churnedStudents: churnedStudents.length,
      inGraceStudents: inGraceStudents.length,
      multiActivityStudents,
      renewalPercentage: Math.round(renewalPercentage * 10) / 10,
      churnPercentage: Math.round(churnPercentage * 10) / 10,
      retentionPercentage: Math.round(retentionPercentage * 10) / 10,
      netGrowthPercentage: Math.round(netGrowthPercentage * 10) / 10,
      lifetimeValue
    };
  }

  static calculateMonthlyTrends(students: Student[], months: number = 12): MonthlyMetrics[] {
    const endDate = new Date();
    const startDate = subMonths(endDate, months);
    
    const monthlyData: MonthlyMetrics[] = [];

    for (let i = 0; i < months; i++) {
      const monthStart = subMonths(endDate, months - i - 1);
      const monthEnd = endOfMonth(monthStart);
      const prevMonthEnd = endOfMonth(subMonths(monthStart, 1));
      
      // Students active at start of month (end of previous month)
      const startOfMonthStudents = students.filter(student => {
        if (!student.endDate) return false;
        return student.enrollmentDate <= prevMonthEnd && student.endDate > prevMonthEnd;
      });

      // New enrollments in current month
      const newEnrollments = students.filter(student => 
        isWithinInterval(student.enrollmentDate, { start: monthStart, end: monthEnd })
      );

      // Students who should have renewed but didn't (dropped)
      const droppedStudents = startOfMonthStudents.filter(student => {
        if (!student.endDate) return false;
        const graceEndDate = addDays(student.endDate, 45);
        const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
          student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);
        return graceEndDate >= monthStart && graceEndDate <= monthEnd && !hasRenewal;
      });

      const startCount = startOfMonthStudents.length;
      const joinedCount = newEnrollments.length;
      const droppedCount = droppedStudents.length;
      const endCount = startCount + joinedCount - droppedCount;

      const churnRate = startCount > 0 ? (droppedCount / startCount) * 100 : 0;
      const retentionRate = 100 - churnRate;
      const netGrowthRate = startCount > 0 ? ((endCount - startCount) / startCount) * 100 : 0;
      
      // Calculate renewal rate for the month
      const eligibleForRenewal = students.filter(student => {
        if (!student.endDate) return false;
        return isWithinInterval(student.endDate, { start: monthStart, end: monthEnd });
      });
      
      const renewedInMonth = eligibleForRenewal.filter(student => {
        if (!student.renewalDates || student.renewalDates.length === 0) return false;
        const graceEndDate = addDays(student.endDate!, 45);
        return student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);
      });
      
      const renewalRate = eligibleForRenewal.length > 0 
        ? (renewedInMonth.length / eligibleForRenewal.length) * 100 
        : 0;

      monthlyData.push({
        month: format(monthStart, 'MMM yyyy'),
        date: monthStart,
        startOfMonth: startCount,
        newEnrollments: joinedCount,
        dropped: droppedCount,
        endOfMonth: endCount,
        churnRate: Math.round(churnRate * 10) / 10,
        retentionRate: Math.round(retentionRate * 10) / 10,
        netGrowthRate: Math.round(netGrowthRate * 10) / 10,
        renewalRate: Math.round(renewalRate * 10) / 10
      });
    }

    return monthlyData;
  }

  static calculateTrendData(students: Student[], months: number = 12): TrendData[] {
    const monthlyMetrics = this.calculateMonthlyTrends(students, months);
    
    return monthlyMetrics.map(metric => ({
      month: metric.month,
      renewalRate: metric.renewalRate,
      churnRate: metric.churnRate,
      retentionRate: metric.retentionRate,
      netGrowthRate: metric.netGrowthRate
    }));
  }

  static getActivityChurnRates(students: Student[]): ActivityData[] {
    const activityMap: Map<string, {
      enrollments: number;
      renewals: number;
      churned: number;
      active: number;
    }> = new Map();

    students.forEach(student => {
      student.activities.forEach(activity => {
        if (!activityMap.has(activity)) {
          activityMap.set(activity, { enrollments: 0, renewals: 0, churned: 0, active: 0 });
        }

        const data = activityMap.get(activity)!;
        data.enrollments++;

        // Check if student renewed
        if (student.renewalDates && student.renewalDates.length > 0) {
          data.renewals++;
        }

        // Check if student churned
        const now = new Date();
        if (student.endDate) {
          const graceEndDate = addDays(student.endDate, 45);
          const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
            student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);
          
          if (isAfter(now, graceEndDate) && !hasRenewal) {
            data.churned++;
          } else {
            data.active++;
          }
        } else {
          data.active++;
        }
      });
    });

    return Array.from(activityMap.entries())
      .map(([activity, data]) => ({
        activity,
        enrollments: data.enrollments,
        renewals: data.renewals,
        dropRate: data.enrollments > 0 
          ? Math.round((data.churned / data.enrollments) * 100 * 10) / 10 
          : 0,
        activeStudents: data.active
      }))
      .sort((a, b) => b.dropRate - a.dropRate);
  }

  static getStudentsWithLTV(students: Student[]): StudentWithLTV[] {
    return students.map(student => ({
      ...student,
      lifetimeValue: student.fees || 0,
      studentId: student.id
    }));
  }

  static getNewEnrollments(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    return this.getStudentsWithLTV(
      this.filterStudentsByDateRange(students, dateRange)
    );
  }

  static getEligibleStudents(students: Student[]): StudentWithLTV[] {
    const now = new Date();
    const eligible = students.filter(student => {
      if (!student.endDate) return false;
      return isBefore(student.endDate, now);
    });
    return this.getStudentsWithLTV(eligible);
  }

  static getRenewedStudents(students: Student[]): StudentWithLTV[] {
    const now = new Date();
    const renewed = students.filter(student => {
      if (!student.renewalDates || student.renewalDates.length === 0) return false;
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      return student.renewalDates.some(renewalDate => 
        isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
      );
    });
    return this.getStudentsWithLTV(renewed);
  }

  static getChurnedStudents(students: Student[]): StudentWithLTV[] {
    const now = new Date();
    const churned = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, graceEndDate) && !hasRenewal;
    });
    return this.getStudentsWithLTV(churned);
  }

  static getInGraceStudents(students: Student[]): StudentWithLTV[] {
    const now = new Date();
    const inGrace = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal;
    });
    return this.getStudentsWithLTV(inGrace);
  }

  static getMultiActivityStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const filtered = this.filterStudentsByDateRange(students, dateRange);
    const multiActivity = filtered.filter(s => s.activities.length > 1);
    return this.getStudentsWithLTV(multiActivity);
  }

  static getStudentsByActivity(students: Student[], activityName: string): StudentWithLTV[] {
    const filtered = students.filter(student => 
      student.activities.includes(activityName)
    );
    return this.getStudentsWithLTV(filtered);
  }
}