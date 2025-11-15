import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addDays, isBefore, isAfter, differenceInCalendarMonths, addMonths } from 'date-fns';
import { RenewalRecord, Student ,StudentWithLTV,} from '../types/Student';
import {  UnifiedMetrics, MonthlyMetrics, TrendData, DateRange } from '../types/UnifiedTypes';
import { ActivityData } from '../types/Student';

export class UnifiedDataProcessor {
  /**
   * Merges student records that represent the same person but have different IDs.
   * e.g., 'INHYDKP01-KB-910-ADYARAMMPR' and 'INHYDKP01-BN-910-ADYARAMMPR'
   * are merged into a single record with a composite ID.
   */
  static mergeStudentRecords(students: Student[]): Student[] {
    const studentMap = new Map<string, Student>();

    const getBaseId = (id: string): string => {
      const parts = id.split('-');
      if (parts.length > 2) {
        // Assumes the variant part is the second one, e.g., 'KB' in 'INHYDKP01-KB-910-...'
        return `${parts[0]}-${parts.slice(2).join('-')}`;
      }
      return id;
    };

    students.forEach(student => {
      const baseId = getBaseId(student.id);
      const existingStudent = studentMap.get(baseId);

      if (existingStudent) {
        // Merge properties from the new record into the existing one.

        // Combine activities, ensuring no duplicates.
        existingStudent.activities = [...new Set([...existingStudent.activities, ...student.activities])];
        
        // Combine course categories, ensuring no duplicates.
        existingStudent.courseCategories = [...new Set([...existingStudent.courseCategories, ...student.courseCategories])];

        // Use the latest endDate.
        if (student.endDate && (!existingStudent.endDate || isAfter(student.endDate, existingStudent.endDate))) {
          existingStudent.endDate = student.endDate;
        }

        // Combine renewal dates.
        const combinedRenewalDates = [...existingStudent.renewalDates, ...student.renewalDates];
        // Using getTime() for Set uniqueness because Date objects are compared by reference.
        const uniqueTimeStamps = new Set(combinedRenewalDates.map(d => d.getTime()));
        existingStudent.renewalDates = Array.from(uniqueTimeStamps).map(ts => new Date(ts));

        // Sum fees.
        existingStudent.fees = (existingStudent.fees || 0) + (student.fees || 0);

        
        // Use the latest enrollment date as the primary one.
        if (isAfter(student.enrollmentDate, existingStudent.enrollmentDate)) {
          existingStudent.enrollmentDate = student.enrollmentDate;
        }

        // Update other fields if necessary, e.g., take the latest info.
        existingStudent.name = student.name || existingStudent.name;
        existingStudent.email = student.email || existingStudent.email;
        existingStudent.phone = student.phone || existingStudent.phone;

      } else {
        studentMap.set(baseId, { ...student });
      }
    });

    return Array.from(studentMap.values());
  }

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
    const startOfPeriodStudents = this.getActiveStudentsAtDate(students, renewalStudents, startDate);
    const startOfPeriodCount = startOfPeriodStudents.length;

    const renewalPercentage = eligibleRenewals > 0
      ? (totalRenewals / eligibleRenewals) * 100
      : 0;

    const churnPercentage = startOfPeriodCount > 0
      ? (churnedStudents.length / startOfPeriodCount) * 100
      : 0;

    const retentionPercentage = 100 - churnPercentage;

    // Calculate net growth: ((End - Start) / Start) * 100
    const endOfPeriodCount = startOfPeriodCount + newEnrollments - churnedStudents.length;
    const netGrowthPercentage = startOfPeriodCount > 0
      ? ((endOfPeriodCount - startOfPeriodCount) / startOfPeriodCount) * 100
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

  static calculateMonthlyTrends(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): MonthlyMetrics[] {
    const { startDate, endDate } = dateRange;

    const rangeStart = startOfMonth(startDate);
    const rangeEnd = endOfMonth(endDate);
    const monthCount = differenceInCalendarMonths(rangeEnd, rangeStart) + 1;

    const monthlyData: MonthlyMetrics[] = [];
    
    const now = new Date();

    for (let i = 0; i < monthCount; i++) {
      const monthStart = addMonths(rangeStart, i);
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
      const renewalsInMonth = renewalStudents.filter(student =>
        student.renewalDate &&
        isWithinInterval(student.renewalDate, { start: monthStart, end: monthEnd }) &&
        (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals')
      );

      // Students who didn't renew within 45-day grace period (dropped)
      const droppedStudents = students.filter(student => {
        if (!student.endDate) return false;

        const graceEndDate = addDays(student.endDate, 45);
        const latestRenewal = student.renewalDates?.length
          ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
          : null;
        const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

        // Churn is counted in the month the subscription's endDate falls, if the grace period has expired.
        return (
          isAfter(now, graceEndDate) &&
          !hasValidRenewal &&
          isWithinInterval(student.endDate, { start: monthStart, end: monthEnd })
        );
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
      const eligibleForRenewal_Enrollment = students.filter(student => {
        if (!student.enrolledEndDate) return false;
        return isWithinInterval(student.enrolledEndDate, { start: monthStart, end: monthEnd });
      }).length;

      const eligibleForRenewal_Renewal = renewalStudents.filter(student => {
        if (!student.endDate) return false;
        return isWithinInterval(student.endDate, { start: monthStart, end: monthEnd });
      }).length;

      const eligibleForRenewal = eligibleForRenewal_Enrollment + eligibleForRenewal_Renewal;

      const renewedInMonth = renewalStudents.filter(student =>
        student.renewalDate &&
        isWithinInterval(student.renewalDate, { start: monthStart, end: monthEnd }) &&
        (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals')
      ).length;

      

      const renewalRate = eligibleForRenewal > 0
        ? (renewedInMonth / eligibleForRenewal) * 100
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

  static calculateTrendData(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): TrendData[] {
    const monthlyMetrics = this.calculateMonthlyTrends(students, renewalStudents, dateRange);

    return monthlyMetrics.map(metric => ({
      month: metric.month,
      renewalRate: metric.renewalRate,
      churnRate: metric.churnRate,
      retentionRate: metric.retentionRate,
      netGrowthRate: metric.netGrowthRate
    }));
  }

  static getCourseCategoryEnrollments(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): Array<{ courseCategory: string; enrollments: number; renewals: number }> {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);
  
    const categoryMap: Map<string, {
      enrollments: number;
      renewals: number;
    }> = new Map();
  
    // Process enrollments
    students.forEach(student => {
      if (student.enrollmentDate >= startDate && student.enrollmentDate <= endDate) {
        student.courseCategories.forEach(category => {
          if (!category) return;
    
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { enrollments: 0, renewals: 0 });
          }
          const data = categoryMap.get(category)!;
          data.enrollments++;
        });
      }
    });
  
    // Process renewals
    renewalStudents.forEach(student => {
      if (student.renewalDate && student.renewalDate >= startDate && student.renewalDate <= endDate && (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals')) {
        student.courseCategories.forEach(category => {
          if (!category) return;
    
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { enrollments: 0, renewals: 0 });
          }
          const data = categoryMap.get(category)!;
          data.renewals++;
        });
      }
    });
  
    return Array.from(categoryMap.entries())
      .map(([courseCategory, data]) => ({
        courseCategory,
        enrollments: data.enrollments,
        renewals: data.renewals,
      }))
      .sort((a, b) => b.enrollments - a.enrollments);
  }
  static getCourseCategoryChurnRates(students: Student[], dateRange: DateRange): Array<{ courseCategory: string; churnedStudents: number }> {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const categoryMap: Map<string, {
      churned: number;
    }> = new Map();
  
    const now = new Date();
  
    students.forEach(student => {
      if (!student.endDate) return;

      const graceEndDate = addDays(student.endDate, 45);
      const latestRenewal = student.renewalDates?.length
        ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
        : null;

      const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

      if (isAfter(now, graceEndDate) && !hasValidRenewal && student.endDate >= startDate && student.endDate <= endDate) {
        student.courseCategories.forEach(category => {
          if (!category) return;

          if (!categoryMap.has(category)) {
            categoryMap.set(category, { churned: 0 });
          }
          const data = categoryMap.get(category)!;
          data.churned++;
        });
      }
    });
  
    return Array.from(categoryMap.entries())
      .map(([courseCategory, data]) => ({
        courseCategory,
        churnedStudents: data.churned
      }))
      .sort((a, b) => b.churnedStudents - a.churnedStudents);
  }

  

  // static getActivityChurnRates(students: Student[]): ActivityData[] {
  //   const activityMap: Map<string, {
  //     enrollments: number;
  //     renewals: number;
  //     churned: number;
  //     active: number;
  //   }> = new Map();

  //   students.forEach(student => {
  //     student.activities.forEach(activity => {
  //       if (!activityMap.has(activity)) {
  //         activityMap.set(activity, { enrollments: 0, renewals: 0, churned: 0, active: 0 });
  //       }

  //       const data = activityMap.get(activity)!;
  //       data.enrollments++;

  //       // Check if student renewed
  //       if (student.renewalDates && student.renewalDates.length > 0) {
  //         data.renewals++;
  //       }

  //       // Check if student churned
  //       const now = new Date();
  //       if (student.endDate) {
  //         const graceEndDate = addDays(student.endDate, 45);
  //         const hasRenewal = student.renewalDates && student.renewalDates.length > 0 &&
  //           student.renewalDates.some(renewalDate => renewalDate <= graceEndDate);

  //         if (isAfter(now, graceEndDate) && !hasRenewal) {
  //           data.churned++;
  //         } else {
  //           data.active++;
  //         }
  //       } else {
  //         data.active++;
  //       }
  //     });
  //   });

  //   return Array.from(activityMap.entries())
  //     .map(([activity, data]) => ({
  //       activity,
  //       enrollments: data.enrollments,
  //       renewals: data.renewals,
  //       dropRate: data.enrollments > 0
  //         ? Math.round((data.churned / data.enrollments) * 100 * 10) / 10
  //         : 0,
  //       activeStudents: data.active
  //     }))
  //     .sort((a, b) => b.dropRate - a.dropRate);
  // }

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
      courseCategories: student.courseCategories,
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


  static getEnrolledStudentsByCourseCategory(students: Student[], categoryName: string, dateRange: DateRange): StudentWithLTV[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const filtered = students.filter(student =>
      student.courseCategories.includes(categoryName) &&
      student.enrollmentDate >= startDate &&
      student.enrollmentDate <= endDate
    );
    return this.getStudentsWithLTV(filtered);
  }

  static getChurnedStudentsByCourseCategory(students: Student[], categoryName: string, dateRange: DateRange): StudentWithLTV[] {
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    const now = new Date();
    const filtered = students.filter(student => {
      if (!student.courseCategories.includes(categoryName) || !student.endDate) return false;

      // Filter by endDate within the date range
      if (!(student.endDate >= startDate && student.endDate <= endDate)) return false;

      // Apply churn logic
      const graceEndDate = addDays(student.endDate, 45);
      const latestRenewal = student.renewalDates?.length
        ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
        : null;

      // Renewal valid only if after end date (i.e., actual extension)
      const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

      return isAfter(now, graceEndDate) && !hasValidRenewal;
    });
    return this.getStudentsWithLTV(filtered);
  }

  // static getActivityEnrollments(students: Student[]): ActivityData[] {
  //   const activityMap: Map<string, {
  //     enrollments: number;
  //     renewals: number;
  //     dropOffs: number;
  //   }> = new Map();

  //   students.forEach(student => {
  //     student.activities.forEach(activity => {
  //       if (!activityMap.has(activity)) {
  //         activityMap.set(activity, { enrollments: 0, renewals: 0, dropOffs: 0 });
  //       }

  //       const data = activityMap.get(activity)!;
  //       data.enrollments++;

  //       // Count all renewals
  //       if (student.renewalDates && student.renewalDates.length > 0) {
  //         data.renewals += student.renewalDates.length;
  //       }

  //       if (student.isStrikeOff) {
  //         data.dropOffs++;
  //       }
  //     });
  //   });

  //   return Array.from(activityMap.entries())
  //     .map(([activity, data]) => ({
  //       activity,
  //       enrollments: data.enrollments,
  //       renewals: data.renewals,
  //       dropRate: data.enrollments > 0
  //         ? Math.round((data.dropOffs / data.enrollments) * 100 * 100) / 100
  //         : 0
  //     }))
  //     .sort((a, b) => b.enrollments - a.enrollments);
  // }

  // static getTopActivities(students: Student[], limit: number = 5): ActivityData[] {
  //   return this.getActivityEnrollments(students).slice(0, limit);
  // }

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

  static getEnrollmentsForLastNDays(students: Student[], days: number): StudentWithLTV[] {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const enrollments = students.filter(student => {
      const enrollmentDate = new Date(student.enrollmentDate);
      return enrollmentDate >= startDate &&
        enrollmentDate <= endDate &&
        (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments');
    });

    return this.getStudentsWithLTV(enrollments);
  }

  static getRenewalsForLastNDays(renewalStudents: RenewalRecord[], days: number): RenewalRecord[] {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const renewals = renewalStudents.filter(student => {
      // We check enrollmentDate because renewals are also stored in the students array with a 'Renewal' source
      const renewalDate = new Date(student.renewalDate!);
      return renewalDate >= startDate &&
        renewalDate <= endDate &&
        (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals');
    });

    return renewals;
  }

  static getTodayRenewals(renewalStudents: RenewalRecord[]): RenewalRecord[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayRenewals = renewalStudents.filter(student => {
      const enrollmentDate = new Date(student.renewalDate!);
      return enrollmentDate >= today &&
        enrollmentDate <= todayEnd &&
        (student.source === 'Renewal' || student.source === 'HistoricalRenewal' || student.source === 'RazorpayRenewals');
    });

    return todayRenewals;
  }

  static getCurrentlyActiveStudents(students: Student[], renewalStudents: RenewalRecord[]): StudentWithLTV[] {
    return this.getActiveStudentsAtDate(students, renewalStudents, new Date());
  }

  static getCurrentlyActiveMultiActivityStudents(students: Student[], renewalStudents: RenewalRecord[]): StudentWithLTV[] {
    const activeStudents = this.getCurrentlyActiveStudents(students, renewalStudents);
    const multiActivityStudents = activeStudents.filter(student => student.activities.length > 1);
    return multiActivityStudents;
  }

  private static buildStudentMap(students: Student[], renewalStudents: RenewalRecord[]): Map<string, Student> {
    // Get unique students by ID to avoid duplicates
    const studentMap = new Map<string, Student>();

    students.forEach(student => {
      const existing = studentMap.get(student.id);
      // Keep the record with the latest enrollment date
      if (!existing || isAfter(student.enrollmentDate, existing.enrollmentDate)) {
        studentMap.set(student.id, student);
      }
    });

    // Add or update students from renewal records
    renewalStudents.forEach(renewal => {
      const existingStudent = studentMap.get(renewal.id);
      if (existingStudent) {
        // If student exists, update with the latest endDate from renewals
        if (renewal.endDate && (!existingStudent.endDate || isAfter(renewal.endDate, existingStudent.endDate))) {
          existingStudent.endDate = renewal.endDate;
        }
        // If a renewal record marks them as LTV, they are LTV from that point on.
        if (renewal.package?.includes('LTV')) {
          existingStudent.package = renewal.package;
        }
        // If the new renewal date is earlier, update the enrollmentDate
        if (renewal.renewalDate && isBefore(renewal.renewalDate, existingStudent.enrollmentDate)) {
          existingStudent.enrollmentDate = renewal.renewalDate;
        }
        // Combine and de-duplicate renewal dates
        if (renewal.renewalDate) {
          const combinedRenewalDates = [...existingStudent.renewalDates, renewal.renewalDate];
          // Using getTime() for Set uniqueness because Date objects are compared by reference.
          const uniqueTimeStamps = new Set(combinedRenewalDates.map(d => d.getTime()));
          existingStudent.renewalDates = Array.from(uniqueTimeStamps).map(ts => new Date(ts));
        }
      } else {
        // If student from renewal is not in the main student list, add them.
        // We create a partial Student object.
        studentMap.set(renewal.id, { ...renewal, id: renewal.id, name: renewal.name, enrollmentDate: renewal.renewalDate || new Date(0), renewalDates: renewal.renewalDate ? [renewal.renewalDate] : [], activities: renewal.activities.split(','), isActive: false, isStrikeOff: false, endDate: renewal.endDate, package: renewal.package });
      }
    });
    return studentMap;
  }

  static getActiveStudentsAtDate(students: Student[], renewalStudents: RenewalRecord[], date: Date): StudentWithLTV[] {
    const studentMap = this.buildStudentMap(students, renewalStudents);
    const uniqueStudents = Array.from(studentMap.values());

    const activeStudents = uniqueStudents.filter(student => {
      let isActiveNotExpired;
      let isInGracePeriod;
      if (student.endDate) {
        const graceEndDate = addDays(student.endDate, 45);
        const latestRenewal = student.renewalDates?.length
          ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
          : null;
        // A renewal is only valid if it's an actual extension (after the end date)
        const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

        // Active if: endDate > date (not expired yet)
        // OR: in grace period at 'date' (endDate < date < graceEndDate) AND no renewal
        isActiveNotExpired = isAfter(student.endDate, date);
        isInGracePeriod = isAfter(date, student.endDate) && isBefore(date, graceEndDate) && !hasValidRenewal;
      }
      const hasLTV = student.package && student.package.includes('LTV');

      return isActiveNotExpired || isInGracePeriod || hasLTV;
    });

    return this.getStudentsWithLTV(activeStudents);
  }
}