import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addDays, isBefore, isAfter, differenceInCalendarMonths, addMonths } from 'date-fns';
import { RenewalRecord, Student, StudentWithLTV, } from '../types/Student';
import { UnifiedMetrics, MonthlyMetrics, TrendData, DateRange } from '../types/UnifiedTypes';
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

    static getActiveStudentsInDateRange(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): StudentWithLTV[] {
        const startDate = new Date(dateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Build the student map to merge records
        const studentMap = this.buildStudentMap(students, renewalStudents);
        const uniqueStudents = Array.from(studentMap.values());

        // Get currently active students using the same logic as getCurrentlyActiveStudents
        const now = new Date();
        const activeStudentsInRange = uniqueStudents.filter(student => {
            let isActiveNotExpired = false;
            let isInGracePeriod = false;

            if (student.endDate) {
                const graceEndDate = addDays(student.endDate, 45);
                const latestRenewal = student.renewalDates?.length
                    ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
                    : null;

                // A renewal is only valid if it's an actual extension (after the end date)
                const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

                // Active if: endDate > now (not expired yet)
                // OR: in grace period (endDate < now < graceEndDate) AND no renewal
                isActiveNotExpired = isAfter(student.endDate, now);
                isInGracePeriod = isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasValidRenewal;

                // Filter by date range: check if endDate falls within the date range
                const endDateInRange = student.endDate >= startDate && student.endDate <= endDate;

                const hasLTV = student.package && student.package.includes('LTV');
                const isActive = (isActiveNotExpired || isInGracePeriod || hasLTV);

                return isActive && endDateInRange;
            }

            return false;
        });

        return this.getStudentsWithLTV(activeStudentsInRange);
    }

    static getMultiActivityStudents(students: Student[], renewalStudents: RenewalRecord[], dateRange: DateRange): StudentWithLTV[] {
        const startDate = new Date(dateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Helper function to extract base ID (removes category code)
        const getBaseId = (id: string): string => {
            const parts = id.split('-');
            if (parts.length > 2) {
                return `${parts[0]}-${parts.slice(2).join('-')}`;
            }
            return id;
        };

        // Helper function to extract category code from student ID
        const getCategoryCode = (id: string): string | null => {
            const parts = id.split('-');
            if (parts.length > 2) {
                return parts[1].toUpperCase();
            }
            return null;
        };

        // Step 1: Identify ALL multi-category students (across all enrollment AND renewal records)
        const allEnrollmentStudents = students.filter(student =>
            student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments'
        );

        // Also convert renewal records to Student format for category checking
        const renewalAsStudents: Student[] = renewalStudents.map(r => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            activities: r.activities.split(',').map(a => a.trim()),
            courseCategories: r.courseCategories,
            enrollmentDate: r.renewalDate || new Date(),
            renewalDates: r.renewalDate ? [r.renewalDate] : [],
            endDate: r.endDate,
            isActive: false,
            isStrikeOff: false,
            fees: r.fees,
            package: r.package,
            source: r.source
        }));

        // Combine all records for category analysis
        const allRecords = [...allEnrollmentStudents, ...renewalAsStudents];

        // Group by base ID and collect unique category codes across ALL records
        const baseCategoryMap = new Map<string, Set<string>>();

        allRecords.forEach(student => {
            const baseId = getBaseId(student.id);
            const categoryCode = getCategoryCode(student.id);

            if (categoryCode) {
                if (!baseCategoryMap.has(baseId)) {
                    baseCategoryMap.set(baseId, new Set());
                }
                baseCategoryMap.get(baseId)!.add(categoryCode);
            }
        });

        // Find base IDs with more than one category code
        const multiCategoryBaseIds = Array.from(baseCategoryMap.entries())
            .filter(([_, categoryCodes]) => categoryCodes.size > 1)
            .map(([baseId, _]) => baseId);

        // Step 2: Use buildStudentMap to get fully merged student records
        const mergedStudentMap = this.buildStudentMap(students, renewalStudents);
        const allMergedStudents = Array.from(mergedStudentMap.values());

        // Step 3: Filter to multi-category students who have at least one enrollment OR renewal in the date range
        const studentsInRange = students.filter(student =>
            student.enrollmentDate >= startDate &&
            student.enrollmentDate <= endDate &&
            (student.source === 'FormResponses1' || student.source === 'OldFormResponses1' || student.source === 'RazorpayEnrollments')
        );

        // Also check renewal records for date range
        const renewalsInRange = renewalStudents.filter(renewal =>
            renewal.renewalDate &&
            renewal.renewalDate >= startDate &&
            renewal.renewalDate <= endDate
        );

        // Get base IDs of students who have enrollments OR renewals in the date range
        const baseIdsInRange = new Set([
            ...studentsInRange.map(s => getBaseId(s.id)),
            ...renewalsInRange.map(r => getBaseId(r.id))
        ]);

        // Step 4: Filter to only include multi-category students with enrollments/renewals in date range
        const multiCategoryStudentsInRange = allMergedStudents.filter(student => {
            const baseId = getBaseId(student.id);
            return multiCategoryBaseIds.includes(baseId) && baseIdsInRange.has(baseId);
        });

        return this.getStudentsWithLTV(multiCategoryStudentsInRange);
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
        // Helper function to extract base ID (removes category code)
        const getBaseId = (id: string): string => {
            const parts = id.split('-');
            if (parts.length > 2) {
                // Assumes the category code is the second part, e.g., 'KB' in 'INHYDKP01-KB-910-...'
                return `${parts[0]}-${parts.slice(2).join('-')}`;
            }
            return id;
        };

        // Helper function to extract category code from student ID
        const getCategoryCode = (id: string): string | null => {
            const parts = id.split('-');
            if (parts.length > 2) {
                // The category code is the second part, e.g., 'KB' in 'INHYDKP01-KB-910-...'
                return parts[1].toUpperCase();
            }
            return null;
        };

        // Step 1: Identify students with multiple course categories by grouping records with different category codes
        // Combine all records (students + renewals) to check for multiple categories
        const allRecords = [...students, ...renewalStudents.map(r => ({
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            activities: r.activities.split(','),
            courseCategories: r.courseCategories,
            enrollmentDate: r.renewalDate || new Date(),
            renewalDates: r.renewalDate ? [r.renewalDate] : [],
            endDate: r.endDate,
            isActive: false,
            isStrikeOff: false,
            fees: r.fees,
            package: r.package,
            source: r.source
        } as Student))];

        // Group by base ID and collect unique category codes for each base student
        const baseCategoryMap = new Map<string, Set<string>>();

        allRecords.forEach(record => {
            const baseId = getBaseId(record.id);
            const categoryCode = getCategoryCode(record.id);

            if (categoryCode) {
                if (!baseCategoryMap.has(baseId)) {
                    baseCategoryMap.set(baseId, new Set());
                }
                baseCategoryMap.get(baseId)!.add(categoryCode);
            }
        });

        // Find base IDs with more than one category code
        const multiCategoryBaseIds = Array.from(baseCategoryMap.entries())
            .filter(([_, categoryCodes]) => categoryCodes.size > 1)
            .map(([baseId, _]) => baseId);

        console.log(`🎯 Students with multiple course categories: ${multiCategoryBaseIds.length}`);
        console.log(`📋 Sample multi-category base IDs:`, multiCategoryBaseIds.slice(0, 5));

        // Step 2: Build student map and get currently active students with multiple categories
        const studentMap = this.buildStudentMap(students, renewalStudents);
        const allStudents = Array.from(studentMap.values());

        console.log(`📊 Total unique students after buildStudentMap: ${allStudents.length}`);

        // Filter to only include students whose base ID has multiple categories
        const multiCategoryStudents = allStudents.filter(student => {
            const baseId = getBaseId(student.id);
            const isMultiCategory = multiCategoryBaseIds.includes(baseId);

            // Debug logging for specific student
            if (student.id.toLowerCase().includes('ameybaheti')) {
                const categoryCode = getCategoryCode(student.id);
                const categoryCodes = baseCategoryMap.get(baseId);
                console.log(`🔍 DEBUG - Amey Baheti (Step 2 - Filter):`, {
                    id: student.id,
                    baseId,
                    categoryCode,
                    allCategoryCodes: categoryCodes ? Array.from(categoryCodes) : [],
                    isMultiCategory
                });
            }

            return isMultiCategory;
        });

        console.log(`📌 Multi-category students found in allStudents: ${multiCategoryStudents.length}`);

        // Step 3: Apply the currently active student logic (from getCurrentlyActiveStudents)
        const now = new Date();
        const activeMultiCategoryStudents = multiCategoryStudents.filter(student => {
            let isActiveNotExpired = false;
            let isInGracePeriod = false;

            if (student.endDate) {
                const graceEndDate = addDays(student.endDate, 45);
                const latestRenewal = student.renewalDates?.length
                    ? new Date(Math.max(...student.renewalDates.map(d => d.getTime())))
                    : null;
                // A renewal is only valid if it's an actual extension (after the end date)
                const hasValidRenewal = latestRenewal && isAfter(latestRenewal, student.endDate);

                // Active if: endDate > now (not expired yet)
                // OR: in grace period (endDate < now < graceEndDate) AND no renewal
                isActiveNotExpired = isAfter(student.endDate, now);
                isInGracePeriod = isAfter(now, student.endDate) && isBefore(now, graceEndDate) && !hasValidRenewal;
            }

            const hasLTV = student.package && student.package.includes('LTV');
            const isActive = isActiveNotExpired || isInGracePeriod || hasLTV;

            // Debug logging for specific student
            if (student.id.toLowerCase().includes('ameybaheti')) {
                console.log(`🔍 DEBUG - Amey Baheti (Step 3 - Active Check):`, {
                    id: student.id,
                    endDate: student.endDate,
                    package: student.package,
                    renewalDates: student.renewalDates,
                    isActiveNotExpired,
                    isInGracePeriod,
                    hasLTV,
                    isActive
                });
            }

            return isActive;
        });

        console.log(`✅ Currently active multi-category students: ${activeMultiCategoryStudents.length}`);

        return this.getStudentsWithLTV(activeMultiCategoryStudents);
    }
    private static buildStudentMap(students: Student[], renewalStudents: RenewalRecord[]): Map<string, Student> {
        // Helper function to extract base ID (removes category code)
        const getBaseId = (id: string): string => {
            const parts = id.split('-');
            if (parts.length > 2) {
                // Assumes the category code is the second part, e.g., 'KB' in 'INHYDKP01-KB-910-...'
                return `${parts[0]}-${parts.slice(2).join('-')}`;
            }
            return id;
        };

        // Map students by base ID to merge records for the same person
        const baseStudentMap = new Map<string, Student>();

        // Debug: Log all PAVAKI records to see what we're starting with
        const pavakiStudents = students.filter(s => s.id.toLowerCase().includes('pavakimavu'));
        const pavakiRenewals = renewalStudents.filter(r => r.id.toLowerCase().includes('pavakimavu'));
        if (pavakiStudents.length > 0 || pavakiRenewals.length > 0) {
            console.log('🔍 ALL PAVAKI RECORDS:', {
                studentRecords: pavakiStudents.map(s => ({
                    id: s.id,
                    activities: s.activities,
                    activity: s.activity,
                    courseCategories: s.courseCategories
                })),
                renewalRecords: pavakiRenewals.map(r => ({
                    id: r.id,
                    activities: r.activities,
                    courseCategories: r.courseCategories
                }))
            });
        }

        students.forEach(student => {
            const baseId = getBaseId(student.id);
            const existing = baseStudentMap.get(baseId);

            if (existing) {
                // Merge properties from the new record into the existing one

                // Combine activities from both activities array AND single activity field
                const allActivities = [
                    ...existing.activities,
                    ...student.activities,
                    // Add single activity field if it exists
                    ...(student.activity ? [student.activity] : [])
                ];
                existing.activities = [...new Set(allActivities.filter(a => a && a.trim()))];

                // Debug logging for specific student
                if (student.id.toLowerCase().includes('pavakimavu')) {
                    console.log('🔍 PAVAKI merge:', {
                        studentId: student.id,
                        existingActivities: existing.activities,
                        newActivitiesArray: student.activities,
                        newActivityField: student.activity,
                        mergedActivities: existing.activities
                    });
                }

                // Combine course categories, ensuring no duplicates
                existing.courseCategories = [...new Set([...existing.courseCategories, ...student.courseCategories])];

                // Use the latest endDate
                if (student.endDate && (!existing.endDate || isAfter(student.endDate, existing.endDate))) {
                    existing.endDate = student.endDate;
                }

                // Use the latest enrolledEndDate
                if (student.enrolledEndDate && (!existing.enrolledEndDate || isAfter(student.enrolledEndDate, existing.enrolledEndDate))) {
                    existing.enrolledEndDate = student.enrolledEndDate;
                }

                // Combine renewal dates
                const combinedRenewalDates = [...existing.renewalDates, ...student.renewalDates];
                const uniqueTimeStamps = new Set(combinedRenewalDates.map(d => d.getTime()));
                existing.renewalDates = Array.from(uniqueTimeStamps).map(ts => new Date(ts));

                // Sum fees
                existing.fees = (existing.fees || 0) + (student.fees || 0);
                existing.enrolledFees = (existing.enrolledFees || 0) + (student.enrolledFees || 0);

                // Use the earliest enrollment date
                if (isBefore(student.enrollmentDate, existing.enrollmentDate)) {
                    existing.enrollmentDate = student.enrollmentDate;
                }

                // Update other fields if necessary
                existing.name = student.name || existing.name;
                existing.email = student.email || existing.email;
                existing.phone = student.phone || existing.phone;

                // Keep LTV package if either has it
                if (student.package?.includes('LTV') && !existing.package?.includes('LTV')) {
                    existing.package = student.package;
                }
            } else {
                // First record for this base student - include both activities array and single activity field
                const initialActivities = [
                    ...student.activities,
                    ...(student.activity ? [student.activity] : [])
                ].filter(a => a && a.trim());

                // Debug logging for specific student
                if (student.id.toLowerCase().includes('pavakimavu')) {
                    console.log('🔍 PAVAKI first record:', {
                        studentId: student.id,
                        activitiesArray: student.activities,
                        activityField: student.activity,
                        initialActivities,
                        finalActivities: [...new Set(initialActivities)]
                    });
                }

                baseStudentMap.set(baseId, {
                    ...student,
                    activities: [...new Set(initialActivities)]
                });
            }
        });

        // Add or update students from renewal records
        renewalStudents.forEach(renewal => {
            const baseId = getBaseId(renewal.id);
            const existingStudent = baseStudentMap.get(baseId);

            if (existingStudent) {
                // Merge renewal data into existing student

                // Update with the latest endDate from renewals
                if (renewal.endDate && (!existingStudent.endDate || isAfter(renewal.endDate, existingStudent.endDate))) {
                    existingStudent.endDate = renewal.endDate;
                }

                // If a renewal record marks them as LTV, they are LTV from that point on
                if (renewal.package?.includes('LTV')) {
                    existingStudent.package = renewal.package;
                }

                // Combine and de-duplicate renewal dates
                if (renewal.renewalDate) {
                    const combinedRenewalDates = [...existingStudent.renewalDates, renewal.renewalDate];
                    const uniqueTimeStamps = new Set(combinedRenewalDates.map(d => d.getTime()));
                    existingStudent.renewalDates = Array.from(uniqueTimeStamps).map(ts => new Date(ts));
                }

                // Merge course categories from renewal
                existingStudent.courseCategories = [...new Set([...existingStudent.courseCategories, ...renewal.courseCategories])];

                // Merge activities from renewal (renewal.activities is a string, split by comma)
                const renewalActivities = renewal.activities.split(',').map(a => a.trim()).filter(a => a);
                existingStudent.activities = [...new Set([...existingStudent.activities, ...renewalActivities])];

                // Add fees from renewal
                existingStudent.fees = (existingStudent.fees || 0) + renewal.fees;
            } else {
                // If student from renewal is not in the main student list, add them
                baseStudentMap.set(baseId, {
                    ...renewal,
                    id: renewal.id,
                    name: renewal.name,
                    enrollmentDate: renewal.renewalDate || new Date(0),
                    renewalDates: renewal.renewalDate ? [renewal.renewalDate] : [],
                    activities: renewal.activities.split(',').map(a => a.trim()),
                    courseCategories: renewal.courseCategories || [],
                    isActive: false,
                    isStrikeOff: false,
                    endDate: renewal.endDate,
                    package: renewal.package
                });
            }
        });

        return baseStudentMap;
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