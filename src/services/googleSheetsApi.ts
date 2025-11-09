import axios from "axios";
import { Student } from "../types/Student";
import {RenewalRecord} from "../types/Student";

const GOOGLE_SHEETS_API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

export class GoogleSheetsService {
  private apiKey: string;
  private sheetId: string;
  private debugLogs: string[] = [];

  constructor() {
    this.apiKey = GOOGLE_SHEETS_API_KEY || "";
    this.sheetId = SHEET_ID || "";
  }

  private log(message: string) {
    console.log(message);
    this.debugLogs.push(message);
  }

  async fetchSheetData(sheetName: string, range: string = "A:U"): Promise<any[][]> {
    try {
      this.log(`📥 Fetching sheet: ${sheetName} (${range})`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${sheetName}!${range}?key=${this.apiKey}`;
      const response = await axios.get(url);
      const values = response.data.values || [];
      this.log(`✅ ${sheetName}: ${values.length} rows`);
      return values;
    } catch (error) {
      this.log(`⚠️ Could not fetch sheet ${sheetName}: ${(error as Error).message}`);
      return [];
    }
  }

  async fetchBothSheets(): Promise<{ enrollmentData: any[][]; renewalData: any[][] }> {
    this.log("🔄 Fetching data from all relevant sheets...");

    const [
      formResponses,
      oldFormResponses,
      razorpayEnrollments,
      renewals,
      historicalRenewals,
      razorpayRenewals,
    ] = await Promise.all([
      this.fetchSheetData("FormResponses1"),
      this.fetchSheetData("OldFormResponses1"),
      this.fetchSheetData("RazorpayEnrollments"),
      this.fetchSheetData("Renewal"),
      this.fetchSheetData("HistoricalRenewal"),
      this.fetchSheetData("RazorpayRenewals"),
    ]);

    const tagData = (data: any[][], source: string): any[][] => {
      if (data.length <= 1) return [];
      const header = data[0];
      const taggedRows = data.slice(1).map((row) => [...row, source]);
      return [header, ...taggedRows];
    };

    const enrollmentData = [
      ...tagData(formResponses, "FormResponses1"),
      ...tagData(oldFormResponses, "OldFormResponses1").slice(1),
      ...tagData(razorpayEnrollments, "RazorpayEnrollments").slice(1),
    ];

    const renewalData = [
      ...tagData(renewals, "Renewal"),
      ...tagData(historicalRenewals, "HistoricalRenewal").slice(1),
      ...tagData(razorpayRenewals, "RazorpayRenewals").slice(1),
    ];

    this.log(`✅ Combined Data Summary:
      • Enrollment Rows: ${enrollmentData.length}
      • Renewal Rows: ${renewalData.length}
    `);

    return { enrollmentData, renewalData };
  }

  parseStudentData(
    enrollmentData: any[][],
    renewalData: any[][]
  ): {
    parsedStudents: Student[];
    renewalRecords: RenewalRecord[];
  } {
    if (enrollmentData.length < 2) {
      this.log("⚠️ Enrollment sheet is empty or missing headers.");
      return { parsedStudents: [], renewalRecords: [] };
    }

    const studentMap: Map<string, Student> = new Map();
    const renewalRecords: RenewalRecord[] = [];

    const normalizeId = (id: string) => id?.trim().toLowerCase().replace(/\s+/g, "") || "";

    const missingIdRows: { id: string; name: string; source: string }[] = [];
    const duplicateStudents: { id: string; source: string }[] = [];
    const unmatchedRenewals: { id: string; row: number; source: string }[] = [];
    const invalidDateRows: { id: string; name: string; source: string; date: string }[] = [];

    let invalidDateCount = 0;
    let missingIdCount = 0;
    let duplicateCount = 0;
    let unmatchedRenewalCount = 0;

    this.log(`📊 Parsing ${enrollmentData.length - 1} enrollment rows...`);

    // ============================
    // ENROLLMENT PARSING
    // ============================
    for (let i = 1; i < enrollmentData.length; i++) {
      const row = enrollmentData[i];
      if (!row || row.length === 0) continue;

      const source = row[row.length - 1];
      const rawId = row[20];
      const studentId = normalizeId(rawId) || normalizeId(`${row[2] || "unknown"}-${i}`);
      const startDate = this.parseDate(row[7]);
      const endDate = this.parseDate(row[16]);

      if (!rawId) {
        missingIdCount++;
        missingIdRows.push({
          id: `Row ${i + 1} - Generated: ${studentId}`,
          name: row[2] || "Unknown",
          source,
        });
      }

      if (!startDate) {
        invalidDateCount++;
        invalidDateRows.push({
          id: studentId,
          name: row[2] || "Unknown",
          source,
          date: `${row[7] || "N/A"}`,
        });
      }

      const isStrikeOff = this.isRowStrikeOff(row);
      const activities = this.parseActivities(row[6] || "");

      if (studentMap.has(studentId)) {
        duplicateCount++;
        duplicateStudents.push({ id: studentId, source });
        const existing = studentMap.get(studentId)!;
        existing.activities = Array.from(new Set([...existing.activities, ...activities]));
        continue;
      }

      studentMap.set(studentId, {
        id: studentId,
        name: row[2] || "Unknown",
        email: row[1] || undefined,
        phone: row[4] || undefined,
        activities,
        enrollmentDate: startDate,
        endDate,
        renewalDates: [],
        isActive: !isStrikeOff,
        isStrikeOff,
        fees: row[9] ? parseFloat(row[9].replace(/[$,₹]/g, "")) : undefined,
        notes: row[19] || undefined,
        package: row[5] || undefined,
        source,
      });
    }

    // ============================
    // RENEWAL PARSING
    // ============================
    for (let i = 1; i < renewalData.length; i++) {
      const row = renewalData[i];
      if (!row || row.length === 0) continue;

      const source = row[row.length - 1];
      const rawId = row[20];
      const studentId = normalizeId(rawId) || `renewal-${i}`;
      const renewalDate = this.parseDate(row[7]);
      const endDate = this.parseDate(row[16]);
      const renewalFees = row[9] ? parseFloat(row[9].replace(/[$,₹]/g, "")) : 0;

      // ✅ Always record renewal (even if duplicate)
    
      renewalRecords.push({
        id: studentId,
        name: row[2] || "Unknown",
        renewalDate,
        endDate,
        fees: renewalFees,
        source,
        activities: row[6] || "",
        email: row[1] || undefined,
        phone: row[4] || undefined,
        package: row[5] || undefined,
      });

      if (!renewalDate) {
        invalidDateCount++;
        invalidDateRows.push({
          id: studentId,
          name: row[2] || "Unknown",
          source,
          date: `${row[7] || "N/A"}`,
        });
        continue;
      }

      if (studentMap.has(studentId)) {
        const student = studentMap.get(studentId)!;
        if (!student.renewalDates.some((d) => d.getTime() === renewalDate.getTime())) {
          student.renewalDates.push(renewalDate);
        }
        if (renewalFees > 0) student.fees = (student.fees || 0) + renewalFees;
      } else {
        unmatchedRenewalCount++;
        unmatchedRenewals.push({ id: studentId, row: i + 1, source });
      }
    }

    // ============================
    // LOG SUMMARY
    // ============================
    this.log(`✅ Parsing Summary:
  • Total Students: ${studentMap.size}
  • Total Renewals (incl. duplicates): ${renewalRecords.length}
  • Missing IDs: ${missingIdCount}
  • Invalid Dates: ${invalidDateCount}
  • Duplicates: ${duplicateCount}
  • Unmatched Renewals: ${unmatchedRenewalCount}
  `);

    return {
      parsedStudents: Array.from(studentMap.values()),
      renewalRecords,
    };
  }


  private exportLogs() {
    const blob = new Blob([this.debugLogs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GoogleSheets_Debug_Logs_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    this.log("📁 Debug log file downloaded successfully.");
  }

  private isRowStrikeOff(row: any[]): boolean {
    const status = row[21]?.toString().trim().toUpperCase();
    return status === "STRIKE" || status === "INACTIVE";
  }

  private parseActivities(activitiesStr: string): string[] {
    if (!activitiesStr) return [];
    return activitiesStr.split(",").map((a) => a.trim()).filter(Boolean);
  }

  private parseDate(dateStr: any): Date {
    if (!dateStr) return undefined as any;

    // Handle Google Sheets numeric date serial
    if (!isNaN(dateStr) && typeof dateStr === "number") {
      return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    }

    // Normalize string
    const str = dateStr.toString().trim();

    // Match DD-MM-YYYY or DD/MM/YYYY
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      const [_, day, month, year] = match;
      const yyyy = year.length === 2 ? `20${year}` : year; // support 2-digit year
      return new Date(`${yyyy}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    }

    // Fallback for already valid ISO or US formats
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? undefined as any : parsed;
  }

}

export const googleSheetsService = new GoogleSheetsService();
