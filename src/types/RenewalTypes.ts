export interface StudentRenewalData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  package: string;
  activity: string;
  startDate: Date;
  renewalDate?: Date;
  expirationDate: Date;
  graceEndDate: Date;
  status: 'renewed' | 'churned' | 'inGrace' | 'lifetime';
  isLifetime: boolean;
  packageDuration?: number; // in weeks
}

export interface RenewalStats {
  totalEligible: number;
  renewed: number;
  churned: number;
  inGrace: number;
  lifetime: number;
  renewalPercentage: number;
  churnPercentage: number;
  netRetention: number;
  renewedStudents: StudentRenewalData[];
  churnedStudents: StudentRenewalData[];
  inGraceStudents: StudentRenewalData[];
}

export interface RawStudentData {
  timestamp: string;
  email: string;
  name: string;
  countryCode: string;
  phone: string;
  package: string;
  activity: string;
  startDate: string;
  schedule: string;
  feesPaid: string;
  feesRemaining: string;
  feesRemainingDate: string;
  instagram: string;
  comments: string;
  consent: string;
  days: string;
  endDate: string;
  dueDate: string;
  leaveDays: string;
  internalNote: string;
  studentId: string;
  strikeHelper: string;
  renewalDate?: string;
}