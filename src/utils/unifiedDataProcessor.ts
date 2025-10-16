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
    const newEnrollments = this.filterStudentsByDateRange(students, dateRange).length;
    
    // Multi-Activity Students (from filtered enrollments)
    const multiActivityStudents = this.filterStudentsByDateRange(students, dateRange)
      .filter(s => s.activities.length > 1).length;
    
    // Calculate renewal metrics
    const now = new Date();
    
    // Eligible students: those whose end date falls within the selected date range
    const eligibleStudents = students.filter(student => {
      if (!student.endDate) return false;
      return isWithinInterval(student.endDate, {
        start: dateRange.startDate,
        end: dateRange.endDate
      });
    });

    const renewedStudents = students.filter(student => {
      if (!student.renewalDates || student.renewalDates.length === 0) return false;
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      // Filter by renewal date falling within the selected date range
      return student.renewalDates.some(renewalDate => 
        (isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()) &&
        isWithinInterval(renewalDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        })
      );
    });

    const churnedStudents = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      // Filter by grace period end date falling within the selected date range
      return isAfter(now, graceEndDate) && !hasRenewal &&
        isWithinInterval(graceEndDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        });
    });

    const inGraceStudents = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      // Filter by course expiration date within range AND currently in grace period
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal &&
        isWithinInterval(student.endDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        });
    });

    // Calculate percentages
    const renewalPercentage = eligibleStudents.length > 0 
      ? (renewedStudents.length / eligibleStudents.length) * 100 
      : 0;
    
    const churnPercentage = eligibleStudents.length > 0 
      ? (churnedStudents.length / eligibleStudents.length) * 100 
      : 0;
    
    const retentionPercentage = 100 - churnPercentage;
    
    // Calculate net growth: ((End - Start) / Start) * 100
    const startOfPeriod = eligibleStudents.length;
    const endOfPeriod = startOfPeriod + newEnrollments - churnedStudents.length;
    const netGrowthPercentage = startOfPeriod > 0 
      ? ((endOfPeriod - startOfPeriod) / startOfPeriod) * 100 
      : 0;
    
    // Calculate total LTV for students in date range
    const studentsInRange = students.filter(student => 
      isWithinInterval(student.enrollmentDate, {
        start: dateRange.startDate,
        end: dateRange.endDate
      }) || 
      (student.renewalDates && student.renewalDates.some(renewalDate =>
        isWithinInterval(renewalDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        })
      ))
    );
    
    const lifetimeValue = studentsInRange.reduce((total, student) => {
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

      // Renewals in current month
      const renewalsInMonth = students.filter(student =>
        student.renewalDates && student.renewalDates.some(renewalDate =>
          isWithinInterval(renewalDate, { start: monthStart, end: monthEnd })
        )
      );

      // Students who didn't renew within 45-day grace period (dropped)
      const droppedStudents = students.filter(student => {
        if (!student.endDate) return false;
        const graceEndDate = addDays(student.endDate, 45);
        const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
          student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);
        return graceEndDate >= monthStart && graceEndDate <= monthEnd && !hasRenewal;
      });

      const startCount = startOfMonthStudents.length;
      const joinedCount = newEnrollments.length;
      const renewalCount = renewalsInMonth.length;
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
        renewals: renewalCount,
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

  static getEligibleStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const eligible = students.filter(student => {
      if (!student.endDate) return false;
      return isWithinInterval(student.endDate, {
        start: dateRange.startDate,
        end: dateRange.endDate
      });
    });
    return this.getStudentsWithLTV(eligible);
  }

  static getRenewedStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const renewed = students.filter(student => {
      if (!student.renewalDates || student.renewalDates.length === 0) return false;
      if (!student.endDate) return false;
      
      const graceEndDate = addDays(student.endDate, 45);
      // Filter by renewal date falling within the selected date range
      return student.renewalDates.some(renewalDate => 
        (isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()) &&
        isWithinInterval(renewalDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        })
      );
    });
    return this.getStudentsWithLTV(renewed);
  }

  static getChurnedStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const now = new Date();
    const churned = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      // Filter by grace period end date falling within the selected date range
      return isAfter(now, graceEndDate) && !hasRenewal &&
        isWithinInterval(graceEndDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        });
    });
    return this.getStudentsWithLTV(churned).map(student => ({
      ...student,
      isActive: false // Mark churned students as inactive
    }));
  }

  static getInGraceStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const now = new Date();
    const inGrace = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate => 
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      // Filter by course expiration date within range AND currently in grace period
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal &&
        isWithinInterval(student.endDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        });
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

        // Count all renewals
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
}