import axios from "axios";
import { Student } from "../types/Student";

const GOOGLE_SHEETS_API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

export class GoogleSheetsService {
  private apiKey: string;
  private sheetId: string;

  constructor() {
    this.apiKey = GOOGLE_SHEETS_API_KEY || "";
    this.sheetId = SHEET_ID || "";
  }

  async fetchSheetData(sheetName: string, range: string = "A:U"): Promise<any[][]> {
    try {
      console.log(`📥 Fetching sheet: ${sheetName} (${range})`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${sheetName}!${range}?key=${this.apiKey}`;
      const response = await axios.get(url);
      const values = response.data.values || [];
      console.log(`✅ ${sheetName}: ${values.length} rows`);
      return values;
    } catch (error) {
      console.warn(`⚠️ Could not fetch sheet ${sheetName}:`, error);
      return [];
    }
  }

  async fetchBothSheets(): Promise<{ enrollmentData: any[][]; renewalData: any[][] }> {
    console.log("🔄 Fetching data from all relevant sheets...");

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

    // Helper to tag each dataset with its source name
    const tagData = (data: any[][], source: string): any[][] => {
      if (data.length <= 1) return [];
      const header = data[0];
      const taggedRows = data.slice(1).map((row) => [...row, source]);
      return [header, ...taggedRows];
    };

    const taggedFormResponses = tagData(formResponses, "FormResponses1");
    const taggedOldFormResponses = tagData(oldFormResponses, "OldFormResponses1");
    const taggedRazorpayEnrollments = tagData(razorpayEnrollments, "RazorpayEnrollments");
    const taggedRenewals = tagData(renewals, "Renewal");
    const taggedHistoricalRenewals = tagData(historicalRenewals, "HistoricalRenewal");
    const taggedRazorpayRenewals = tagData(razorpayRenewals, "RazorpayRenewals");

    // ✅ Merge enrollment data
    const enrollmentData = [
      ...(taggedFormResponses.length ? taggedFormResponses : []),
      ...(taggedOldFormResponses.slice(1) || []),
      ...(taggedRazorpayEnrollments.slice(1) || []),
    ];

    // ✅ Merge renewal data
    const renewalData = [
      ...(taggedRenewals.length ? taggedRenewals : []),
      ...(taggedHistoricalRenewals.slice(1) || []),
      ...(taggedRazorpayRenewals.slice(1) || []),
    ];

    console.log(`✅ Combined Data Summary:
      • Enrollment Rows: ${enrollmentData.length}
      • Renewal Rows: ${renewalData.length}
    `);

    return { enrollmentData, renewalData };
  }

  parseStudentData(enrollmentData: any[][], renewalData: any[][]): Student[] {
    if (enrollmentData.length < 2) {
      console.warn("⚠️ Enrollment sheet is empty or missing headers.");
      return [];
    }

    const studentMap: Map<string, Student> = new Map();
    const normalizeId = (id: string) => id?.trim().toLowerCase().replace(/\s+/g, "") || "";

    // Debug trackers
    const missingIdRows: string[] = [];
    const duplicateStudents: string[] = [];
    const unmatchedRenewals: string[] = [];

    let invalidDateCount = 0;
    let missingIdCount = 0;
    let duplicateCount = 0;
    let unmatchedRenewalCount = 0;
    let formEnrollments = 0;
    let oldFormEnrollments = 0;
    let razorpayEnrollments = 0;
    let renewalCount = 0;
    let historicalRenewalCount = 0;
    let razorpayRenewalCount = 0;

    console.log(`📊 Parsing ${enrollmentData.length - 1} enrollment rows...`);

    // ✅ Enrollment parsing
    for (let i = 1; i < enrollmentData.length; i++) {
      const row = enrollmentData[i];
      if (!row || row.length === 0) continue;

      const source = row[row.length - 1];
      if (source === "RazorpayEnrollments") razorpayEnrollments++;
      else if (source === "OldFormResponses1") oldFormEnrollments++;
      else formEnrollments++;

      const rawId = row[20];
      const studentId = normalizeId(rawId) || normalizeId(`${row[2] || "unknown"}-${i}`);
      const startDate = this.parseDate(row[7]);
      const endDate = this.parseDate(row[16]);

      if (!rawId) {
        missingIdCount++;
        missingIdRows.push(`Row ${i + 1} → Name: ${row[2] || "Unknown"} | Source: ${source}`);
      }

      if (!startDate) invalidDateCount++;

      const isStrikeOff = this.isRowStrikeOff(row);
      const activities = this.parseActivities(row[6] || "");

      if (studentMap.has(studentId)) {
        duplicateCount++;
        duplicateStudents.push(studentId);
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

    // ✅ Renewal parsing
    if (renewalData.length > 1) {
      for (let i = 1; i < renewalData.length; i++) {
        const row = renewalData[i];
        if (!row || row.length === 0) continue;

        const source = row[row.length - 1];
        if (source === "RazorpayRenewals") razorpayRenewalCount++;
        else if (source === "HistoricalRenewal") historicalRenewalCount++;
        else renewalCount++;

        const rawId = row[20];
        const studentId = normalizeId(rawId) || `renewal-${i}`;
        const renewalDate = this.parseDate(row[7]);
        const renewalFees = row[9] ? parseFloat(row[9].replace(/[$,₹]/g, "")) : 0;

        if (!renewalDate) {
          invalidDateCount++;
          continue;
        }

        if (studentMap.has(studentId)) {
          const student = studentMap.get(studentId)!;
          if (!student.renewalDates.some((d) => d.getTime() === renewalDate.getTime())) {
            student.renewalDates.push(renewalDate);
          }
          if (renewalFees > 0) {
            student.fees = (student.fees || 0) + renewalFees;
          }
          student.source = source;
        } else {
          unmatchedRenewalCount++;
          unmatchedRenewals.push(
            `Row ${i + 1} → Renewal Student ID: ${studentId} | Date: ${row[7]} | Source: ${source}`
          );
        }
      }
    }

    // ✅ Print summary
    console.log(`✅ Enrollment Summary:
      • Total: ${enrollmentData.length - 1}
      • FormResponses1: ${formEnrollments}
      • OldFormResponses1: ${oldFormEnrollments}
      • RazorpayEnrollments: ${razorpayEnrollments}
      • Missing IDs: ${missingIdCount}
      • Invalid Dates: ${invalidDateCount}
      • Duplicates: ${duplicateCount}
    `);

    console.log(`✅ Renewal Summary:
      • Total: ${renewalData.length - 1}
      • Renewal: ${renewalCount}
      • HistoricalRenewal: ${historicalRenewalCount}
      • RazorpayRenewals: ${razorpayRenewalCount}
      • Unmatched Renewals: ${unmatchedRenewalCount}
    `);

    if (missingIdRows.length) console.warn("⚠️ Missing Student IDs:\n", missingIdRows.join("\n"));
    if (duplicateStudents.length) console.warn("⚠️ Duplicate Students:\n", duplicateStudents.join("\n"));
    if (unmatchedRenewals.length) console.warn("⚠️ Unmatched Renewals:\n", unmatchedRenewals.join("\n"));

    console.log(`🎯 Final Parsed Students: ${studentMap.size}`);
    return Array.from(studentMap.values());
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
    if (!isNaN(dateStr) && typeof dateStr === "number") {
      return new Date(Math.round((dateStr - 25569) * 86400 * 1000));
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? undefined as any : parsed;
  }
}

export const googleSheetsService = new GoogleSheetsService();
