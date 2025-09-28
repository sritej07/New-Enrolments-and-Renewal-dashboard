import { useState, useEffect } from 'react';
import { Student } from '../types/Student';
import { RawStudentData } from '../types/RenewalTypes';
import { googleSheetsService } from '../services/googleSheetsApi';

export const useStudentData = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [rawStudentData, setRawStudentData] = useState<RawStudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For demo purposes, we'll use mock data if API keys are not available
      if (!import.meta.env.VITE_GOOGLE_SHEETS_API_KEY) {
        setStudents(getMockData());
        return;
      }

      const rawData = await googleSheetsService.fetchSheetData();
      const parsedStudents = googleSheetsService.parseStudentData(rawData);
      const rawParsedData = googleSheetsService.parseRawStudentData(rawData);
      setStudents(parsedStudents);
      setRawStudentData(rawParsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Fallback to mock data
      setStudents(getMockData());
      setRawStudentData(getMockRawData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { students, rawStudentData, loading, error, refetch: fetchData };
};

// Mock data for development
const getMockData = (): Student[] => {
  const activities = ['Swimming', 'Piano', 'Art', 'Dance', 'Karate', 'Guitar', 'Tennis', 'Chess'];
  const students: Student[] = [];

  for (let i = 1; i <= 150; i++) {
    const enrollmentDate = new Date(2022, Math.floor(Math.random() * 36), Math.floor(Math.random() * 28) + 1);
    const hasRenewal = Math.random() > 0.3;
    const isStrikeOff = Math.random() > 0.85;
    
    students.push({
      id: `student-${i}`,
      name: `Student ${i}`,
      email: `student${i}@example.com`,
      phone: `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      activities: Array.from(
        { length: Math.floor(Math.random() * 3) + 1 },
        () => activities[Math.floor(Math.random() * activities.length)]
      ).filter((v, i, a) => a.indexOf(v) === i),
      enrollmentDate,
      lastRenewalDate: hasRenewal ? new Date(enrollmentDate.getTime() + Math.random() * 365 * 24 * 60 * 60 * 1000) : undefined,
      isActive: !isStrikeOff,
      isStrikeOff,
      fees: Math.floor(Math.random() * 500) + 100,
      notes: Math.random() > 0.7 ? 'Special notes' : undefined
    });
  }

  return students;
};

// Mock raw data for development
const getMockRawData = (): RawStudentData[] => {
  const packages = [
    '1 class per week - 12 weeks (12 classes)',
    '2 classes per week - 24 weeks (48 classes)',
    '1 class per week - 4 weeks (4 classes)',
    'Lifetime Access - LTV Package',
    'Intensive Course - 8 weeks (16 classes)'
  ];
  
  const activities = ['Swimming', 'Piano', 'Art', 'Dance', 'Karate', 'Guitar', 'Tennis', 'Chess'];
  const rawData: RawStudentData[] = [];

  for (let i = 1; i <= 100; i++) {
    const startDate = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const hasRenewal = Math.random() > 0.4;
    const renewalDate = hasRenewal ? new Date(startDate.getTime() + Math.random() * 180 * 24 * 60 * 60 * 1000) : undefined;
    
    rawData.push({
      timestamp: new Date().toISOString(),
      email: `student${i}@example.com`,
      name: `Student ${i}`,
      countryCode: '91',
      phone: `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      package: packages[Math.floor(Math.random() * packages.length)],
      activity: activities[Math.floor(Math.random() * activities.length)],
      startDate: startDate.toISOString(),
      schedule: 'Monday 7 PM',
      feesPaid: `$${Math.floor(Math.random() * 1000) + 500}.00`,
      feesRemaining: '$0.00',
      feesRemainingDate: '',
      instagram: '',
      comments: '',
      consent: 'I agree',
      days: '90',
      endDate: '',
      dueDate: 'NA',
      leaveDays: '',
      internalNote: 'Mock data',
      studentId: `MOCK${i.toString().padStart(3, '0')}`,
      strikeHelper: '',
      renewalDate: renewalDate?.toISOString()
    });
  }

  return rawData;
};