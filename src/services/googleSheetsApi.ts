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
        this.fetchSheetData('FormResponses1', 'A:W'),
        this.fetchSheetData('Renewal', 'A:W')
      ]);
      return { enrollmentData, renewalData };
    } catch (error) {
      console.error('Error fetching both sheets:', error);
      throw new Error('Failed to fetch data from both sheets');
    }
  }

  parseStudentData(enrollmentData: any[][], renewalData: any[][]): Student[] {
  if (enrollmentData.length < 2) return [];

  const headers = enrollmentData[0];
  const studentMap: Map<string, Student> = new Map();

  // Process enrollment data
  for (let i = 1; i < enrollmentData.length; i++) {
    const row = enrollmentData[i];
    if (!row || row.length === 0) continue;

    const studentId = row[20] || `student-${i}`;
    const startDate = this.parseDate(row[7]);
    const endDate = this.parseDate(row[16]); // End Date (Q1) column
    const isStrikeOff = this.isRowStrikeOff(row);
    const activities = this.parseActivities(row[6] || '');

    if (!studentMap.has(studentId)) {
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
  }

  // Process renewal data
  if (renewalData.length > 1) {
    for (let i = 1; i < renewalData.length; i++) {
      const row = renewalData[i];
      if (!row || row.length === 0) continue;

      const studentId = row[20] || `renewal-${i}`;
      const renewalDate = this.parseDate(row[7]); // Start Date in renewal sheet is renewal date
      
      if (studentMap.has(studentId) && renewalDate) {
        const student = studentMap.get(studentId)!;
        if (!student.renewalDates.includes(renewalDate)) {
          student.renewalDates.push(renewalDate);
        }
        // Update fees with renewal fees
        const renewalFees = row[9] ? parseFloat(row[9].replace(/[$,]/g, '')) : 0;
        if (renewalFees > 0) {
          student.fees = (student.fees || 0) + renewalFees;
        }
      }
    }
  }

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

  private parseDate(dateStr: string): Date {
    if (!dateStr) return undefined as any;

    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      const parts = dateStr.split(/[-\/]/);
      if (parts.length >= 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return undefined as any;
    }
    return parsedDate;
  }
}

export const googleSheetsService = new GoogleSheetsService();
