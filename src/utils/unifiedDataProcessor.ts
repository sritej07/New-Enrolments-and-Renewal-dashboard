import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addDays, isBefore, isAfter } from 'date-fns';
import { RenewalRecord, Student } from '../types/Student';
import { StudentWithLTV, UnifiedMetrics, MonthlyMetrics, TrendData, DateRange } from '../types/UnifiedTypes';
import { ActivityData } from '../types/Student';

export class UnifiedDataProcessor {
  static filterStudentsByDateRange(students: Student[], dateRange: DateRange): Student[] {
    // Ensure start date is inclusive by using start of day
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Ensure end date is inclusive by using end of day
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    return students.filter(student =>
      student.enrollmentDate >= startDate && student.enrollmentDate <= endDate
    );
  }

  static calculateUnifiedMetrics(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): UnifiedMetrics {
    console.log('📊 Calculating unified metrics...');
    console.log(`📅 Date Range: ${dateRange.startDate.toDateString()} to ${dateRange.endDate.toDateString()}`);
    console.log(`👥 Total Students: ${students.length}`);

    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    // New Enrollments: All records from enrollment sheets within date range
    const newEnrollments = students.filter(student =>
      student.enrollmentDate >= startDate &&
      student.enrollmentDate <= endDate &&
      (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments')
    ).length;
    console.log(`🆕 New Enrollments: ${newEnrollments}`);

    // Renewals: All records from renewal sheets within date range
    const totalRenewals = renewalStudents.filter(student =>
      student.renewalDate !== undefined && // added check
      student.renewalDate >= startDate &&
      student.renewalDate <= endDate &&
      (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals')
    ).length;
    console.log(`🔄 Total Renewals: ${totalRenewals}`);

    // Eligible Renewals: Students whose end date falls within the date range
    const eligibleRenewals_Enrollment = students.filter(student => {
      if (!student.enrolledEndDate) return false;
      return student.enrolledEndDate >= startDate && student.enrolledEndDate <= endDate;
    }).length;
    const eligibleRenewals_Renewal = renewalStudents.filter(student => {
      if (!student.endDate) return false;
      return student.endDate >= startDate && student.endDate <= endDate;
    }).length;
    const eligibleRenewals = eligibleRenewals_Enrollment + eligibleRenewals_Renewal;

    console.log(`✅ Eligible Renewals: ${eligibleRenewals}`);

    // Multi-Activity Students (from enrollment records only)
    const enrollmentStudents = students.filter(student =>
      student.enrollmentDate >= startDate &&
      student.enrollmentDate <= endDate &&
      (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments')
    );

    const studentActivityMap = new Map<string, Set<string>>();

    // Collect all unique activities per student ID
    enrollmentStudents.forEach(student => {
      if (!studentActivityMap.has(student.id)) {
        studentActivityMap.set(student.id, new Set());
      }

      const activities = studentActivityMap.get(student.id)!;

      // Add activities from the activities array (for merged data)
      student.activities.forEach(activity => {
        if (activity && activity.trim()) {
          activities.add(activity.trim());
        }
      });

      // Add single activity from activity field (for separate row data)
      if (student.activity && student.activity.trim()) {
        activities.add(student.activity.trim());
      }
    });

    const now = new Date();
    const churnedStudents = students.filter(student => {
      if (!student.endDate) return false;

      const graceEndDate = addDays(student.endDate, 45);
      const latestRenewal = student.renewalDates?.length
        ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
        : null;

      // Renewal valid only if after end date (i.e., actual extension)
      const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

      // Churn if grace expired and no valid renewal
      return (
        isAfter(now, graceEndDate) &&
        !hasValidRenewal &&
        student.endDate >= startDate &&
        student.endDate <= endDate
      )
    });

    console.log(`❌ Churned Students: ${churnedStudents.length} `);

    const inGraceStudents = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate =>
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal &&
        student.endDate >= startDate && student.endDate <= endDate;
    });

    console.log(`⏳ In Grace Students: ${inGraceStudents.length} `);

    // Count multi-activity students
    const multiActivityStudents = Array.from(studentActivityMap.values())
      .filter(activities => activities.size > 1)
      .length;

    // Calculate percentages
    const renewalPercentage = eligibleRenewals > 0
      ? (totalRenewals / eligibleRenewals) * 100
      : 0;

    const churnPercentage = eligibleRenewals > 0
      ? (churnedStudents.length / eligibleRenewals) * 100
      : 0;

    const retentionPercentage = 100 - churnPercentage;

    // Calculate net growth: ((End - Start) / Start) * 100
    const startOfPeriod = eligibleRenewals;
    const endOfPeriod = startOfPeriod + newEnrollments - churnedStudents.length;
    const netGrowthPercentage = startOfPeriod > 0
      ? ((endOfPeriod - startOfPeriod) / startOfPeriod) * 100
      : 0;

    // Calculate total LTV for students in date range
    const studentsInRange = students.filter(student =>
      student.enrollmentDate >= startDate && student.enrollmentDate <= endDate
    );

    const lifetimeValue = studentsInRange.reduce((total, student) => {
      return total + (student.fees || 0);
    }, 0);

    return {
      newEnrollments,
      eligibleStudents: eligibleRenewals,
      renewedStudents: totalRenewals,
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
      studentId: student.id,
    }));
  }


  static getNewEnrollments(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const enrollments = students.filter(student =>
      student.enrollmentDate >= startDate &&
      student.enrollmentDate <= endDate &&
      (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments')
    );
    return this.getStudentsWithLTV(enrollments);
  }

  static getEligibleStudents(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): RenewalRecord[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Eligible from original enrollments
    const eligibleFromEnrollments: RenewalRecord[] = students.filter(student => {
      if (!student.enrolledEndDate) return false;
      return student.enrolledEndDate >= startDate && student.enrolledEndDate <= endDate;
    }).map(student => ({
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      activities: student.activities.join(', '),
      renewalDate: student.enrollmentDate, // Using enrolledEndDate as the key date
      endDate: student.enrolledEndDate,
      package: student.package,
      fees: student.enrolledFees || 0,
      source: student.source || 'Error'
    }));

    // Eligible from renewals
    const eligibleFromRenewals = renewalStudents.filter(student => {
      if (!student.endDate) return false;
      return student.endDate >= startDate && student.endDate <= endDate;
    });

    return [...eligibleFromEnrollments, ...eligibleFromRenewals];
  }

  static getRenewedStudents(renewalStudents: RenewalRecord[], dateRange: DateRange): RenewalRecord[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const renewals = renewalStudents.filter(student =>
      student.renewalDate !== undefined && // added check
      student.renewalDate >= startDate &&
      student.renewalDate <= endDate &&
      (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals')
    );

    return renewals;
  }

  static getChurnedStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const now = new Date();
    const churned = students.filter(student => {
      if (!student.endDate) return false;

      const graceEndDate = addDays(student.endDate, 45);
      const latestRenewal = student.renewalDates?.length
        ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
        : null;

      // Renewal valid only if after end date (i.e., actual extension)
      const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

      // Churn if grace expired and no valid renewal
      return (
        isAfter(now, graceEndDate) &&
        !hasValidRenewal &&
        student.endDate >= startDate &&
        student.endDate <= endDate
      );
    });

    return this.getStudentsWithLTV(churned).map(student => ({
      ...student,
      isActive: false
    }));
  }


  static getInGraceStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const now = new Date();
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const inGrace = students.filter(student => {
      if (!student.endDate) return false;
      const graceEndDate = addDays(student.endDate, 45);
      const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
        student.renewalDates.some(renewalDate =>
          isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
        );
      return isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal &&
        student.endDate >= startDate && student.endDate <= endDate;
    });
    return this.getStudentsWithLTV(inGrace);
  }

  static getMultiActivityStudents(students: Student[], dateRange: DateRange): StudentWithLTV[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const enrollmentStudents = students.filter(student =>
      student.enrollmentDate >= startDate &&
      student.enrollmentDate <= endDate &&
      (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments')
    );

    const studentActivityMap = new Map<string, Set<string>>();
    const studentDataMap = new Map<string, Student>();

    // Collect all unique activities per student ID
    enrollmentStudents.forEach(student => {
      if (!studentActivityMap.has(student.id)) {
        studentActivityMap.set(student.id, new Set());
        studentDataMap.set(student.id, student); // Store one instance of student data
      }

      const activities = studentActivityMap.get(student.id)!;

      // Add activities from the activities array (for merged data)
      student.activities.forEach(activity => {
        if (activity && activity.trim()) {
          activities.add(activity.trim());
        }
      });

      // Add single activity from activity field (for separate row data)
      if (student.activity && student.activity.trim()) {
        activities.add(student.activity.trim());
      }
    });

    // Get students with more than 1 unique activity
    const multiActivityStudentIds = Array.from(studentActivityMap.entries())
      .filter(([_, activities]) => activities.size > 1)
      .map(([studentId, _]) => studentId);

    // Return all enrollment records for multi-activity students
    const multiActivityStudents = enrollmentStudents.filter(student =>
      multiActivityStudentIds.includes(student.id)
    );

    return this.getStudentsWithLTV(multiActivityStudents);
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

  // New methods for metrics independent of date filter
  static getTodayEnrollments(students: Student[]): StudentWithLTV[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayEnrollments = students.filter(student => {
      const enrollmentDate = new Date(student.enrollmentDate);
      return enrollmentDate >= today &&
        enrollmentDate <= todayEnd &&
        (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments');
    });

    return this.getStudentsWithLTV(todayEnrollments);
  }

  static getTodayRenewals(students: Student[]): StudentWithLTV[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayRenewals = students.filter(student => {
      const enrollmentDate = new Date(student.enrollmentDate);
      return enrollmentDate >= today &&
        enrollmentDate <= todayEnd &&
        (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals');
    });

    return this.getStudentsWithLTV(todayRenewals);
  }

  static getCurrentlyActiveStudents(students: Student[]): StudentWithLTV[] {
    const now = new Date();

    // Get unique students by ID to avoid duplicates
    const studentMap = new Map<string, Student>();

    students.forEach(student => {
      // Only keep the latest record for each student
      if (!studentMap.has(student.id) ||
        (studentMap.get(student.id)!.enrollmentDate < student.enrollmentDate)) {
        studentMap.set(student.id, student);
      }
    });

    const uniqueStudents = Array.from(studentMap.values());

    const activeStudents = uniqueStudents.filter(student => {
      let isActiveNotExpired;
      let isInGracePeriod;
      if (student.endDate) {
        const graceEndDate = addDays(student.endDate, 45);
        const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
          student.renewalDates.some(renewalDate =>
            isBefore(renewalDate, graceEndDate) || renewalDate.getTime() === graceEndDate.getTime()
          );

        // Active if: endDate > now (not expired yet)
        // OR: currently in grace period (endDate < now < graceEndDate) AND no renewal
        isActiveNotExpired = isAfter(student.endDate, now);
        isInGracePeriod = isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasRenewal;
      }
      const hasLTV = student.package && student.package.includes('LTV');


      // Include students with "LTV" in their package name

      return isActiveNotExpired || isInGracePeriod || hasLTV;
    });

    return this.getStudentsWithLTV(activeStudents);
  }
}