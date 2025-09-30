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
  isLifetime: boolean | null;
  packageDuration?: number | null; // in weeks
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

