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

  async fetchSheetData(range: string = 'Sheet1!A:Z'): Promise<any[][]> {
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
    const students: Student[] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Check if row is strike-off (all columns have strike-through formatting)
      const isStrikeOff = this.isRowStrikeOff(row);
      
      try {
        const student: Student = {
          id: row[0] || `student-${i}`,
          name: row[1] || 'Unknown',
          email: row[2] || undefined,
          phone: row[3] || undefined,
          activities: this.parseActivities(row[4] || ''),
          enrollmentDate: this.parseDate(row[5]),
          lastRenewalDate: row[6] ? this.parseDate(row[6]) : undefined,
          isActive: !isStrikeOff && (row[7]?.toLowerCase() !== 'inactive'),
          isStrikeOff,
          fees: row[8] ? parseFloat(row[8]) : undefined,
          notes: row[9] || undefined
        };

        students.push(student);
      } catch (error) {
        console.warn(`Error parsing student data for row ${i}:`, error);
      }
    }

    return students;
  }

  private isRowStrikeOff(row: any[]): boolean {
    // In practice, you'd need to check the cell formatting
    // For now, we'll check if key fields are empty or contain strike indicators
    const keyFields = [row[1], row[4], row[5]]; // name, activities, enrollment date
    return keyFields.every(field => !field || field.toString().includes('~~'));
  }

  private parseActivities(activitiesStr: string): string[] {
    if (!activitiesStr) return [];
    return activitiesStr.split(',').map(activity => activity.trim()).filter(Boolean);
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    
    // Handle various date formats
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      // Try different parsing approaches
      const parts = dateStr.split(/[-\/]/);
      if (parts.length >= 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return new Date();
    }
    return parsedDate;
  }
}

export const googleSheetsService = new GoogleSheetsService();