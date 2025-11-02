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
      console.log(`📥 Fetching sheet: ${sheetName} with range: ${range}`);
      const fullRange = `${sheetName}!${range}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${fullRange}?key=${this.apiKey}`;
      const response = await axios.get(url);
      const data = response.data.values || [];
      console.log(`✅ Successfully fetched ${data.length} rows from ${sheetName}`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching sheet ${sheetName}:`, error);
      if (error.response?.status === 400) {
        console.warn(`⚠️ Sheet "${sheetName}" might not exist. Returning empty data.`);
        return [];
      }
      throw new Error(`Failed to fetch data from sheet: ${sheetName}`);
    }
  }

  async fetchBothSheets(): Promise<{ enrollmentData: any[][], renewalData: any[][] }> {
    try {
      console.log('🔄 Fetching data from all sheets...');
      
      const [formResponsesData, razorpayEnrollmentsData, renewalData, razorpayRenewalsData] = await Promise.all([
        this.fetchSheetData('FormResponses1', 'A:U'),
        this.fetchSheetData('RazorpayEnrollments', 'A:U'),
        this.fetchSheetData('Renewal', 'A:U'),
        this.fetchSheetData('RazorpayRenewals', 'A:U')
      ]);
      
      console.log('📊 Sheet Data Summary:');
      console.log(`- FormResponses1: ${formResponsesData.length} rows`);
      console.log(`- RazorpayEnrollments: ${razorpayEnrollmentsData.length} rows`);
      console.log(`- Renewal: ${renewalData.length} rows`);
      console.log(`- RazorpayRenewals: ${razorpayRenewalsData.length} rows`);
      
      // Combine enrollment data
      const enrollmentData = [...formResponsesData];
      if (razorpayEnrollmentsData.length > 1) {
        // Skip header row and add data
        enrollmentData.push(...razorpayEnrollmentsData.slice(1));
      }
      
      // Combine renewal data
      const combinedRenewalData = [...renewalData];
      if (razorpayRenewalsData.length > 1) {
        // Skip header row and add data
        combinedRenewalData.push(...razorpayRenewalsData.slice(1));
      }
      
      console.log('✅ Combined Data Summary:');
      console.log(`- Total Enrollment Rows: ${enrollmentData.length}`);
      console.log(`- Total Renewal Rows: ${combinedRenewalData.length}`);
      
      return { enrollmentData, renewalData: combinedRenewalData };
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

  console.log('🔍 Starting student data parsing...');
  console.log(`📊 Input Data: ${enrollmentData.length - 1} enrollment rows, ${renewalData.length - 1} renewal rows`);

  const studentMap: Map<string, Student> = new Map();

  // Helper to normalize student IDs
  const normalizeId = (id: string) => id?.trim().toLowerCase().replace(/\s+/g, '') || '';

  console.log(`📄 Processing enrollment data...`);

  // Track debug stats
  let invalidDateCount = 0;
  let missingIdCount = 0;
  let duplicateCount = 0;
  let totalSkipped = 0;
  let razorpayEnrollments = 0;
  let formResponseEnrollments = 0;

  // Process enrollment data
  for (let i = 1; i < enrollmentData.length; i++) {
    const row = enrollmentData[i];
    if (!row || row.length === 0) {
      console.warn(`⚠️ Row ${i} is completely empty — skipped.`);
      totalSkipped++;
      continue;
    }

    // Track source of enrollment
    const isRazorpayEnrollment = i > (enrollmentData.length - razorpayEnrollments);
    if (isRazorpayEnrollment) {
      razorpayEnrollments++;
    } else {
      formResponseEnrollments++;
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
      source: isRazorpayEnrollment ? 'RazorpayEnrollments' : 'FormResponses1'
    });
  }

  console.log(`✅ Enrollment Parsing Complete:
  • Total Rows: ${enrollmentData.length - 1}
  • Parsed Students: ${studentMap.size}
  • FormResponses1: ${formResponseEnrollments}
  • RazorpayEnrollments: ${razorpayEnrollments}
  • Invalid/Missing Dates: ${invalidDateCount}
  • Missing IDs: ${missingIdCount}
  • Duplicates: ${duplicateCount}
  • Empty Rows Skipped: ${totalSkipped}
  `);

  // Process renewal data
  if (renewalData.length > 1) {
    console.log(`📄 Processing ${renewalData.length - 1} renewal rows...`);
    let unmatchedRenewals = 0;
    let razorpayRenewals = 0;
    let regularRenewals = 0;
    
    for (let i = 1; i < renewalData.length; i++) {
      const row = renewalData[i];
      if (!row || row.length === 0) continue;

      // Track renewal source (this is approximate since we combined the arrays)
      const isRazorpayRenewal = row[0] && row[0].toString().includes('Razorpay');
      if (isRazorpayRenewal) {
        razorpayRenewals++;
      } else {
        regularRenewals++;
      }
      const rawId = row[20];
      const studentId = normalizeId(rawId) || `renewal-${i}`;
      const renewalDate = this.parseDate(row[7]);
      const renewalFees = row[9] ? parseFloat(row[9].replace(/[$,₹]/g, '')) : 0;

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
    • Regular Renewals: ${regularRenewals}
    • Razorpay Renewals: ${razorpayRenewals}
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
