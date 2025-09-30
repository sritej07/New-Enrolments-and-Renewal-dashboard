import { addWeeks, addDays, isAfter, isBefore, isEqual } from 'date-fns';
import { StudentRenewalData, RenewalStats } from '../types/RenewalTypes';
import { Student } from '../types/Student';

/**
 * Extracts package duration from package name
 * Examples: "12 weeks - 24 sessions" → 12, "4 weeks course" → 4
 */
export function extractPackageDuration(packageName: string): number | null {
  // Look for pattern like "12 weeks", "24 weeks", etc.
  const weekMatch = packageName.match(/(\d+)\s*weeks?/i);
  if (weekMatch) {
    return parseInt(weekMatch[1], 10);
  }
  return null;
}

/**
 * Checks if package is lifetime validity
 */
export function isLifetimePackage(packageName: string): boolean {
  return packageName.toUpperCase().includes('LTV');
}

/**
 * Parses raw student data and calculates renewal metrics
 */
export function parseStudentRenewalData(rawData: Student[]): StudentRenewalData[] {
  return rawData.map(student => {
    const startDate = new Date(student.enrollmentDate);
    const renewalDates = student.renewalDates || []; // now stores all renewals
    const isLifetime = student.package ? isLifetimePackage(student.package) : false;
    const packageDuration = student.package ? extractPackageDuration(student.package) : undefined;

    // Calculate expiration date
    let expirationDate: Date;
    if (isLifetime) {
      expirationDate = new Date('2099-12-31');
    } else if (packageDuration) {
      expirationDate = addWeeks(startDate, packageDuration);
    } else {
      expirationDate = addWeeks(startDate, 12); // default to 12 weeks
    }

    // Grace period end (45 days after expiration)
    const graceEndDate = addDays(expirationDate, 45);
    const now = new Date();

    // ✅ FIX: check if ANY renewal is within grace
    const renewedInGrace = renewalDates.some(r =>
      isBefore(r, graceEndDate) || isEqual(r, graceEndDate)
    );

    // Determine status
    let status: StudentRenewalData['status'];
    if (isLifetime) {
      status = 'lifetime';
    } else if (renewedInGrace) {
      status = 'renewed';
    } else if (isAfter(now, graceEndDate)) {
      status = 'churned';
    } else if (isAfter(now, expirationDate)) {
      status = 'inGrace';
    } else {
      status = 'inGrace'; // active but not expired yet
    }

    return {
      id: student.id || `student-${Math.random()}`,
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      package: student.package || '',
      activity: student.activities.length > 0 ? student.activities[0] : 'Unknown',
      startDate,
      renewalDates,
      expirationDate,
      graceEndDate,
      status,
      isLifetime,
      packageDuration,
    };
  });
}

/**
 * Calculates renewal statistics based on business rules
 */
export function calculateRenewalStats(students: StudentRenewalData[]): RenewalStats {
  const now = new Date();

  // Eligible = non-lifetime + package already expired
  const eligibleStudents = students.filter(student =>
    !student.isLifetime && isAfter(now, student.expirationDate)
  );

  const renewedStudents = eligibleStudents.filter(s => s.status === 'renewed');
  const churnedStudents = eligibleStudents.filter(s => s.status === 'churned');
  const inGraceStudents = eligibleStudents.filter(s => s.status === 'inGrace');
  const lifetimeStudents = students.filter(s => s.isLifetime);

  const totalEligible = eligibleStudents.length;
  const renewed = renewedStudents.length;
  const churned = churnedStudents.length;
  const inGrace = inGraceStudents.length;
  const lifetime = lifetimeStudents.length;

  const renewalPercentage = totalEligible > 0 ? (renewed / totalEligible) * 100 : 0;
  const churnPercentage = totalEligible > 0 ? (churned / totalEligible) * 100 : 0;
  const netRetention = renewalPercentage - churnPercentage;

  return {
    totalEligible,
    renewed,
    churned,
    inGrace,
    lifetime,
    renewalPercentage: Math.round(renewalPercentage * 100) / 100,
    churnPercentage: Math.round(churnPercentage * 100) / 100,
    netRetention: Math.round(netRetention * 100) / 100,
    renewedStudents,
    churnedStudents,
    inGraceStudents,
  };
}