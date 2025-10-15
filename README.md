## Project Overview

This is a unified Student Analytics Dashboard that provides comprehensive insights into student enrollments, renewals, churn analysis, and lifecycle tracking. The dashboard integrates data from Google Sheets to deliver real-time analytics with interactive visualizations and drill-down capabilities.

## Dashboard Flow

### 🎯 **Unified Analytics Dashboard**

The dashboard combines enrollment and renewal analytics into a single, comprehensive view with the following sections:

#### **1. Date Range Filter (Top)**
- Calendar-based date picker for start and end dates
- All metrics, charts, and tables respond dynamically to date range changes
- Default range: Last 3 years from current date

#### **2. Primary Metrics Row**
Six key performance indicators displayed as clickable cards:

- **🟢 New Enrollments**: Students enrolled within the selected date range
- **🟡 Eligible Students**: Students whose packages expired within the date range
- **🔵 Renewed Students**: Students who renewed within grace period in the date range
- **🔴 Churned Students**: Students who failed to renew within 45-day grace period
- **🟠 In Grace Period**: Students currently within 45-day grace window
- **🟣 Multi-Activity Students**: Students enrolled in multiple activities

#### **3. Percentage Metrics Row**
Four calculated percentage metrics:

- **Renewal %**: (Renewed ÷ Eligible) × 100
- **Churn %**: (Churned ÷ Eligible) × 100
- **Retention %**: 100 - Churn %
- **Net Growth %**: ((End - Start) ÷ Start) × 100

#### **4. Lifetime Value (LTV)**
- **Total LTV**: Sum of all fees paid by students in the selected date range
- Includes fees from both enrollment and renewal activities

#### **5. Trend Over Time Chart**
Interactive line chart showing monthly trends for:
- Renewal Rate %
- Churn Rate %
- Retention Rate %
- Net Growth Rate %

#### **6. Monthly Enrollment Trends**
Line chart displaying:
- New Enrollments per month
- Renewals per month
- Dropped Students per month (based on grace period expiration)

#### **7. Activity Analysis**
- **Multi-Activity Students Chart**: Doughnut chart showing distribution
- **Enrollments and Renewals by Activity**: Bar chart for top 8 activities

#### **8. Activity Tables**
- **Top Activities by Enrollment**: Ranked by total enrollments
- **Activities with Highest Churn Rates**: Shows churn rates and active student counts

## Business Logic

### **Package Types & Expiration**
- **Lifetime Packages**: Contain "LTV" in package name, excluded from renewal calculations
- **Limited Packages**: Duration extracted from package name (e.g., "12 weeks - 24 sessions" → 12 weeks)
- **Expiration Date**: Fetched directly from 'End Date (Q1)' column in Google Sheets

### **Renewal Window & Grace Period**
- **Grace Period**: 45 days after package expiration date
- **Renewed**: Student has renewal date ≤ grace period end date
- **Churned**: No renewal within 45-day grace period
- **In Grace**: Currently within 45 days after expiration, no renewal yet

### **Churn Calculation Logic**
Based on monthly cohort analysis:
- **Start of Month**: Students active at end of previous month
- **Dropped**: Students who didn't renew within grace period in current month
- **Joined**: New enrollments in current month
- **End of Month**: Start + Joined - Dropped
- **Churn %**: (Dropped ÷ Start) × 100

## Data Sources

### **Google Sheets Integration**
- **Enrollment Data**: `FormResponses1` sheet/tab
- **Renewal Data**: `Renewal` sheet/tab
- **Real-time API**: Fetches data from both sheets and combines student records

### **Key Data Mapping**
- Column A: Timestamp
- Column B: Email Address
- Column C: Student Name
- Column D: Country Code
- Column E: WhatsApp Phone Number
- Column F: Package (duration extracted)
- Column G: Activity
- Column H: Start Date
- Column I: Fees Paid Amount
- Column Q: End Date (Q1) - Used for expiration calculation
- Column U: Student ID
- Renewal sheet contains renewal dates and additional fees

## Interactive Features

### **Clickable Metrics**
- All metric cards are clickable and open detailed student modals
- Student modals show comprehensive information including:
  - Contact details (email, phone)
  - Package information and duration
  - Enrollment and renewal dates
  - Current status with color-coded badges
  - Lifetime value contribution
  - Student ID display

### **Activity Drill-Down**
- Click any activity in tables to see students enrolled in that activity
- Activity-specific metrics and student lists
- Churn rate analysis per activity

### **Status Indicators**
- **Green Badge**: Renewed students
- **Red Badge**: Churned students
- **Yellow Badge**: In grace period
- **Blue Badge**: Active students
- **Purple Badge**: Lifetime package holders

## Technical Architecture

### **Tech Stack**
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts for trend visualizations, Chart.js for other charts
- **Data Processing**: Custom utility classes
- **API Integration**: Axios for Google Sheets API
- **Icons**: Lucide React
- **Date Handling**: date-fns

### **Key Components**
- `UnifiedDataProcessor`: Core business logic and calculations
- `DateRangeFilter`: Date selection component
- `UnifiedStudentModal`: Student detail popup
- `UnifiedTrendChart`: Time-series trend visualization
- `ClickableMetricCard`: Interactive KPI cards

### **Data Flow**
1. **Data Fetching**: Google Sheets API via dual sheet fetching
2. **Data Processing**: `UnifiedDataProcessor` transforms raw data into metrics
3. **State Management**: React hooks manage filtering and modal states
4. **UI Updates**: All components respond to date range changes
5. **Drill-Down**: Click handlers open detailed student information

## Development Commands

### **Essential Commands**
- `npm install` - Install all dependencies
- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

### **Environment Setup**
1. Create `.env` file in project root
2. Add required variables:
   ```
   VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
   VITE_GOOGLE_SHEET_ID=your_sheet_id_here
   ```

3. Google Sheets API Setup:
   - Enable Google Sheets API in Google Cloud Console
   - Create API key credentials
   - Ensure sheets are publicly readable or properly shared

## Key Features

### **Real-Time Analytics**
- Live data synchronization with Google Sheets
- Automatic metric calculations based on business rules
- Dynamic filtering and date range selection

### **Comprehensive Metrics**
- Student lifecycle tracking from enrollment to churn
- Financial metrics with lifetime value calculations
- Activity-based performance analysis

### **Interactive Visualizations**
- Trend analysis with time-series charts
- Comparative analysis across activities
- Drill-down capabilities for detailed insights

### **Business Intelligence**
- Churn prediction and analysis
- Renewal rate optimization insights
- Multi-activity student identification
- Grace period management

The dashboard provides a complete 360° view of student analytics, enabling data-driven decisions for student retention, activity optimization, and business growth.