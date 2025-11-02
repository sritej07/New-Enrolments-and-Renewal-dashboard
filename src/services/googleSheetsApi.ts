import axios from 'axios';
import { Student } from '../types/Student';


const GOOGLE_SHEETS_API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

export class GoogleSheetsService {
  private apiKey: string;
  private sheetId: string;

  constructor() {
    this.apiKey = GOOGLE_SHEETS_API_KEY || '';
    this.sheetId = SHEET_ID || '';
  }

  async fetchSheetData(sheetName: string = 'FormResponses1', range: string = 'A:W'): Promise<any[][]> {
    try {
      const fullRange = `${sheetName}!${range}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${fullRange}?key=${this.apiKey}`;
      const response = await axios.get(url);
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
      throw new Error('Failed to fetch data from Google Sheets');
    }
  }

  async fetchBothSheets(): Promise<{ enrollmentData: any[][], renewalData: any[][] }> {
    try {
      const [enrollmentData, renewalData] = await Promise.all([
        this.fetchSheetData('FormResponses1', 'A:U'),
        this.fetchSheetData('Renewal', 'A:U')
      ]);
      return { enrollmentData, renewalData };
    } catch (error) {
      console.error('Error fetching both sheets:', error);
      throw new Error('Failed to fetch data from both sheets');
    }
  }

  parseStudentData(enrollmentData: any[][], renewalData: any[][]): Student[] {
  if (enrollmentData.length < 2) {
    console.warn("❌ Enrollment sheet seems empty or missing headers.");
    return [];
  }

  const studentMap: Map<string, Student> = new Map();

  // Helper to normalize student IDs
  const normalizeId = (id: string) => id?.trim().toLowerCase().replace(/\s+/g, '') || '';

  console.log(`📄 Processing ${enrollmentData.length - 1} enrollment rows...`);

  // Track debug stats
  let invalidDateCount = 0;
  let missingIdCount = 0;
  let duplicateCount = 0;
  let totalSkipped = 0;

  // Process enrollment data
  for (let i = 1; i < enrollmentData.length; i++) {
    const row = enrollmentData[i];
    if (!row || row.length === 0) {
      console.warn(`⚠️ Row ${i} is completely empty — skipped.`);
      totalSkipped++;
      continue;
    }

    const rawId = row[20];
    const studentId =
      normalizeId(rawId) ||
      normalizeId(`${row[2] || 'unknown'}-${row[6] || 'unknown'}-${i}`);

    const startDate = this.parseDate(row[7]);
    const endDate = this.parseDate(row[16]); // End Date (Q1) column

    if (!startDate) {
      console.warn(`⚠️ Row ${i} missing or invalid Start Date:`, row[7]);
      invalidDateCount++;
    }

    if (!rawId) {
      console.warn(`⚠️ Row ${i} missing Student ID. Using fallback: ${studentId}`);
      missingIdCount++;
    }

    const isStrikeOff = this.isRowStrikeOff(row);
    const activities = this.parseActivities(row[6] || '');

    if (studentMap.has(studentId)) {
      console.warn(`⚠️ Duplicate student ID found (${studentId}) at row ${i}. Appending activities.`);
      duplicateCount++;
      const existing = studentMap.get(studentId)!;
      existing.activities = Array.from(new Set([...existing.activities, ...activities]));
      continue;
    }

    studentMap.set(studentId, {
      id: studentId,
      name: row[2] || 'Unknown',
      email: row[1] || undefined,
      phone: row[4] || undefined,
      activities: activities.length > 0 ? activities : [],
      enrollmentDate: startDate,
      endDate: endDate,
      renewalDates: [],
      isActive: !isStrikeOff,
      isStrikeOff,
      fees: row[9] ? parseFloat(row[9].replace(/[$,]/g, '')) : undefined,
      notes: row[19] || undefined,
      package: row[5] || undefined,
    });
  }

  console.log(`✅ Enrollment Parsing Complete:
  • Total Rows: ${enrollmentData.length - 1}
  • Parsed Students: ${studentMap.size}
  • Invalid/Missing Dates: ${invalidDateCount}
  • Missing IDs: ${missingIdCount}
  • Duplicates: ${duplicateCount}
  • Empty Rows Skipped: ${totalSkipped}
  `);

  // Process renewal data
  if (renewalData.length > 1) {
    console.log(`📄 Processing ${renewalData.length - 1} renewal rows...`);
    let unmatchedRenewals = 0;
    for (let i = 1; i < renewalData.length; i++) {
      const row = renewalData[i];
      if (!row || row.length === 0) continue;

      const rawId = row[20];
      const studentId = normalizeId(rawId) || `renewal-${i}`;
      const renewalDate = this.parseDate(row[7]);
      const renewalFees = row[9] ? parseFloat(row[9].replace(/[$,]/g, '')) : 0;

      if (!renewalDate) {
        console.warn(`⚠️ Renewal row ${i} has invalid date:`, row[7]);
        continue;
      }

      if (studentMap.has(studentId)) {
        const student = studentMap.get(studentId)!;
        const alreadyExists = student.renewalDates.some(d => d.getTime() === renewalDate.getTime());
        if (!alreadyExists) student.renewalDates.push(renewalDate);
        if (renewalFees > 0) student.fees = (student.fees || 0) + renewalFees;
      } else {
        unmatchedRenewals++;
        console.warn(`⚠️ Renewal row ${i} has no matching student ID (${studentId}).`);
      }
    }
    console.log(`✅ Renewal Parsing Complete:
    • Total Renewals: ${renewalData.length - 1}
    • Unmatched Renewals: ${unmatchedRenewals}
    `);
  }

  console.log(`🎯 Final Student Count: ${studentMap.size}`);
  return Array.from(studentMap.values());
}





  private isRowStrikeOff(row: any[]): boolean {
    // Check if any key fields are struck through or marked as inactive
    const strikeHelper = row[21]?.toString().trim().toUpperCase();
    return strikeHelper === 'STRIKE' || strikeHelper === 'INACTIVE';
  }


  private parseActivities(activitiesStr: string): string[] {
    if (!activitiesStr) return [];
    return activitiesStr.split(',').map(a => a.trim()).filter(Boolean);
  }

  private parseDate(dateStr: any): Date {
    if (!dateStr) return undefined as any;

    // If Google Sheets gives date as serial number
    if (!isNaN(dateStr) && typeof dateStr === 'number') {
      return new Date(Math.round((dateStr - 25569) * 86400 * 1000)); // convert Excel serial date
    }

    // If it's a string in DD/MM/YYYY or MM/DD/YYYY
    const normalized = dateStr.replace(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/, (m, p1, p2, p3) => {
      if (parseInt(p1) > 12) return `${p3}-${p2}-${p1}`; // DD/MM/YYYY → YYYY-MM-DD
      return `${p3}-${p1}-${p2}`; // MM/DD/YYYY → YYYY-MM-DD
    });

    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? undefined as any : parsed;
  }

}

export const googleSheetsService = new GoogleSheetsService();
