import { addWeeks, addDays, isAfter, isBefore, isEqual } from 'date-fns';
import { StudentRenewalData, RenewalStats } from '../types/RenewalTypes';
import { Student } from '../types/Student';

// interface TrendPoint {
//   period: string; // e.g. "2025-01", "Q1-2025", "2025"
//   renewalRate: number;
//   churnRate: number;
//   netRetention: number;
// }

// export function calculateTrendStats(
//   parsedData: StudentRenewalData[],
//   period: 'quarter' | 'year' | 'custom',
//   customMonths: number = 6
// ): TrendPoint[] {
//   const groups: Record<string, StudentRenewalData[]> = {};
//   const now = new Date();

//   parsedData.forEach(student => {
//     const date = new Date(student.expirationDate);
//     if (isNaN(date.getTime()) || date > now) return; // skip invalid/future

//     let key = '';
//     if (period === 'year') {
//       key = `${date.getFullYear()}`;
//     } else {
//       // monthly buckets
//       key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//     }

//     if (!groups[key]) groups[key] = [];
//     groups[key].push(student);
//   });

//   let results: TrendPoint[] = [];

//   for (const [key, students] of Object.entries(groups)) {
//     const total = students.length;
//     const renewed = students.filter(s => s.status === 'renewed').length;
//     const churned = students.filter(s => s.status === 'churned').length;

//     const renewalRate = total > 0 ? (renewed / total) * 100 : 0;
//     const churnRate = total > 0 ? (churned / total) * 100 : 0;
//     const netRetention = renewalRate - churnRate;

//     // Format display label
//     let label = key;
//     if (period !== 'year') {
//       const [y, m] = key.split('-').map(Number);
//       const monthName = new Date(y, m - 1).toLocaleString('default', { month: 'short' });
//       label = `${monthName} ${y}`; // e.g. Jan 2025
//     }

//     results.push({
//       period: label,
//       renewalRate: parseFloat(renewalRate.toFixed(1)),
//       churnRate: parseFloat(churnRate.toFixed(1)),
//       netRetention: parseFloat(netRetention.toFixed(1)),
//     });
//   }

//   // sort chronologically
//   results = results.sort((a, b) => {
//     const parseDate = (label: string): Date => {
//       if (period === 'year') {
//         return new Date(parseInt(label), 0, 1);
//       } else {
//         const [monthStr, yearStr] = label.split(' ');
//         return new Date(parseInt(yearStr), new Date(`${monthStr} 1, 2000`).getMonth(), 1);
//       }
//     };
//     return parseDate(a.period).getTime() - parseDate(b.period).getTime();
//   });

//   // restrict data
//   if (period === 'quarter') {
//     results = results.slice(-3); // last 3 months
//   } else if (period === 'custom') {
//     results = results.slice(-customMonths); // last N months
//   } else if (period === 'year') {
//     results = results.slice(-3); // last 3 years
//   }

//   return results;
// }

interface TrendPoint {
  period: string; // e.g. "2025-01", "Q1-2025", "2025"
  renewalRate: number;
  churnRate: number;
  netRetention: number;
}

export function calculateTrendStats(
  parsedData: StudentRenewalData[],
  period: 'quarter' | 'year' | 'custom',
  customMonths: number = 6
): TrendPoint[] {
  const groups: Record<string, StudentRenewalData[]> = {};
  const now = new Date();

  parsedData.forEach(student => {
    const date = new Date(student.expirationDate);
    if (isNaN(date.getTime()) || date > now) return; // skip invalid/future

    let key = '';
    if (period === 'year') {
      key = `${date.getFullYear()}`;
    } else {
      // monthly buckets
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(student);
  });

  let results: TrendPoint[] = [];

  for (const [key, students] of Object.entries(groups)) {
    const total = students.length;
    const renewed = students.filter(s => s.status === 'renewed').length;
    const churned = students.filter(s => s.status === 'churned').length;

    const renewalRate = total > 0 ? (renewed / total) * 100 : 0;
    const churnRate = total > 0 ? (churned / total) * 100 : 0;
    const netRetention = renewalRate - churnRate;

    // Format display label
    let label = key;
    if (period !== 'year') {
      const [y, m] = key.split('-').map(Number);
      const monthName = new Date(y, m - 1).toLocaleString('default', { month: 'short' });
      label = `${monthName} ${y}`; // e.g. Jan 2025
    }

    results.push({
      period: label,
      renewalRate: parseFloat(renewalRate.toFixed(1)),
      churnRate: parseFloat(churnRate.toFixed(1)),
      netRetention: parseFloat(netRetention.toFixed(1)),
    });
  }

  // sort chronologically
  results = results.sort((a, b) => {
    const parseDate = (label: string): Date => {
      if (period === 'year') {
        return new Date(parseInt(label), 0, 1);
      } else {
        const [monthStr, yearStr] = label.split(' ');
        return new Date(parseInt(yearStr), new Date(`${monthStr} 1, 2000`).getMonth(), 1);
      }
    };
    return parseDate(a.period).getTime() - parseDate(b.period).getTime();
  });

  // restrict data
  if (period === 'quarter') {
    results = results.slice(-3); // last 3 months
  } else if (period === 'custom') {
    results = results.slice(-customMonths); // last N months
  } else if (period === 'year') {
    results = results.slice(-3); // last 3 years
  }

  return results;
}


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