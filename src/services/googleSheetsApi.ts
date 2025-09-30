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

  async fetchSheetData(range: string = `${import.meta.env.VITE_SHEET_NAME}!A:V`): Promise<any[][]> {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${range}?key=${this.apiKey}`;
      const response = await axios.get(url);
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching Google Sheets data:', error);
      throw new Error('Failed to fetch data from Google Sheets');
    }
  }

  parseStudentData(rawData: any[][]): Student[] {
  if (rawData.length < 2) return [];

  const headers = rawData[0];
  const studentMap: Map<string, Student> = new Map();

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const studentId = row[20] || `student-${i}`;
    const startDate = this.parseDate(row[7]);
    const isStrikeOff = this.isRowStrikeOff(row);
    const activities = this.parseActivities(row[6] || '');

    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        id: studentId,
        name: row[2] || 'Unknown',
        email: row[1] || undefined,
        phone: row[4] || undefined,
        activities: activities.length > 0 ? activities : [], // init with parsed activities
        enrollmentDate: startDate,
        renewalDates: [],
        isActive: !isStrikeOff,
        isStrikeOff,
        fees: row[9] ? parseFloat(row[9]) : undefined,
        notes: row[19] || undefined,
        package: row[5] || undefined,
      });
    } else {
      const existing = studentMap.get(studentId)!;

      // collect renewal dates
      if (startDate > existing.enrollmentDate) {
        existing.renewalDates.push(startDate);
      }

      // merge new activities (avoid duplicates)
      for (const act of activities) {
        if (!existing.activities.includes(act)) {
          existing.activities.push(act);
        }
      }
    }
  }

  return Array.from(studentMap.values());
}




  private isRowStrikeOff(row: any[]): boolean {
    const marker = row[21]?.toString().trim().toUpperCase(); // Column V
    return marker === 'STRIKE';
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
