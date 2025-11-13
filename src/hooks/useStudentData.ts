import { useState, useEffect } from 'react';
import { Student } from '../types/Student';
import { RenewalRecord } from '../types/Student';
import { googleSheetsService } from '../services/googleSheetsApi';


export const useStudentData = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [renewalRecords, setRenewalRecords] = useState<RenewalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      console.log('🚀 Starting data fetch process...');
      setLoading(true);
      setError(null);
      
      // For demo purposes, we'll use mock data if API keys are not available
      if (!import.meta.env.VITE_GOOGLE_SHEETS_API_KEY) {
        console.warn('⚠️ No API key found, using mock data');
        setStudents(getMockData());
        return;
      }

      console.log('🔑 API key found, fetching real data...');
      const { enrollmentData, renewalData } = await googleSheetsService.fetchBothSheets();
      const {parsedStudents, renewalRecords} = googleSheetsService.parseStudentData(enrollmentData, renewalData);
      
      console.log(`✅ Data fetch complete: ${parsedStudents.length} students processed`);
      setStudents(parsedStudents);
      setRenewalRecords(renewalRecords);
      
    } catch (err) {
      console.error('❌ Error in fetchData:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Fallback to mock data
      console.log('🔄 Falling back to mock data...');
      setStudents(getMockData());
      
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { students, renewalRecords,loading, error, refetch: fetchData };
};

// Mock data for development
const getMockData = (): Student[] => {
  const courseCategories = {
    Keyboard: "KB",
    Piano: "PN",
    Guitar: "GT",
    "Carnatic Vocal": "CV",
    "Hindustani Vocal": "HV",
    Bharatnatyam: "BN",
    Kathak: "KT",
    Tabla: "TB",
    Violin: "VL",
    Handwriting: "HW",
    Art: "AR",
    "Western Dance": "BW",
    Kuchipudi: "KU",
    Other: "Other",
  };
  const activities = Object.keys(courseCategories);
  const students: Student[] = [];

  for (let i = 1; i <= 150; i++) {
    const enrollmentDate = new Date(2022, Math.floor(Math.random() * 36), Math.floor(Math.random() * 28) + 1);
    const activity = activities[Math.floor(Math.random() * activities.length)];
    const courseCode = courseCategories[activity as keyof typeof courseCategories] || 'Other';
    const endDate = new Date(enrollmentDate.getTime() + (Math.random() * 365 * 24 * 60 * 60 * 1000));
    const hasRenewal = Math.random() > 0.3;
    const isStrikeOff = Math.random() > 0.85;
    
    students.push({
      id: `student-${i}`,
      name: `Student ${i}`,
      email: `student${i}@example.com`,
      phone: `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      activities: [activity],
      activity: `INMOCK${courseCode}01-${courseCode}-MOCK-${i}`,
      courseCategory: activity,
      enrollmentDate,
      endDate,
      renewalDates: hasRenewal ? [new Date(enrollmentDate.getTime() + Math.random() * 365 * 24 * 60 * 60 * 1000)] : [],
      isActive: !isStrikeOff,
      isStrikeOff,
      fees: Math.floor(Math.random() * 500) + 100,
      notes: Math.random() > 0.7 ? 'Special notes' : undefined,
    });
  }

  return students;
};
