import axios from "axios";
import { parse } from "date-fns";
import { Student } from "../types/Student";
import {RenewalRecord} from "../types/Student";
import { KeyRound } from "lucide-react";

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

  private getCourseCategory(studentId: string): string {
    const courseCategoryMap: { [key: string]: string } = {
      kb: "Keyboard",
      pn: "Piano",
      gt: "Guitar",
      cv: "Carnatic Vocal",
      hv: "Hindustani Vocal",
      bn: "Bharatnatyam",
      kt: "Kathak",
      tb: "Tabla",
      vl: "Violin", // Covers Carnatic Violin and Violin
      hw: "Handwriting", // Covers Handwriting and Cursive Writing
      ar: "Art",
      bw: "Western Dance",
      ku: "Kuchipudi",
    };
    const parts = studentId?.split("-");
    return (parts && parts.length > 1 && courseCategoryMap[parts[1]]) || "Other";
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
      const courseCategory = this.getCourseCategory(studentId);

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
        enrollmentDate: startDate ?? new Date(),
        endDate,
        enrolledEndDate: endDate,
        enrolledFees: row[9] ? parseFloat(row[9].replace(/[$,₹]/g, "")) : undefined,
        renewalDates: [],
        isActive: !isStrikeOff,
        isStrikeOff,
        fees: row[9] ? parseFloat(row[9].replace(/[$,₹]/g, "")) : undefined,
        notes: row[19] || undefined,
        package: row[5] || undefined,
        source,
        courseCategories: [courseCategory],
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
      const courseCategory = this.getCourseCategory(studentId);

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
        courseCategories:[courseCategory],
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
        if (endDate && (!student.endDate || endDate > student.endDate)) {
          student.endDate = endDate;
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

  private parseDate(dateStr: any): Date | undefined {
    if (!dateStr) return undefined;

    // Handle Google Sheets numeric date serial
    if (!isNaN(dateStr) && typeof dateStr === "number") {
      return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    }

    const str = dateStr.toString().trim();

    // Define possible date formats to try, from most to least specific
    const formats = [
      "MM/dd/yyyy", // 11/02/2025 -> Nov 2
      "M/d/yyyy",   // 11/2/2025 -> Nov 2
      "dd-MM-yyyy", // 08-10-2025 -> Oct 8
      "d-M-yyyy",   // 8-10-2025 -> Oct 8
      "yyyy-MM-dd", // ISO format
      "PP",         // Fallback for localized formats like "Oct 8, 2025"
    ];

    const referenceDate = new Date();

    for (const format of formats) {
      const parsedDate = parse(str, format, referenceDate);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    // Final fallback for other native formats (e.g., ISO with time)
    const finalParsed = new Date(str);
    return isNaN(finalParsed.getTime()) ? undefined : finalParsed;
  }

}

export const googleSheetsService = new GoogleSheetsService();
