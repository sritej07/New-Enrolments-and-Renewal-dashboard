## Project Overview

This is a unified Student Analytics Dashboard that provides comprehensive insights into student enrollments, renewals, churn analysis, and lifecycle tracking. The dashboard integrates data from multiple Google Sheets to deliver real-time analytics with interactive visualizations, dynamic filtering, and drill-down capabilities.

## Dashboard Flow

### 🎯 **Unified Analytics Dashboard**

The dashboard presents a holistic view of student data with the following sections:

#### **1. Filters (Top)**
- **Course Category Filter**: A multi-select dropdown to filter the entire dashboard by one or more course categories.
- **Date Range Filter**: A calendar-based date picker for start and end dates. All metrics and charts below this filter respond dynamically to the selected range.

#### **2. "Today's Metrics" Row**
A set of cards showing key metrics independent of the date range filter, providing a real-time snapshot of daily and recent activity. Includes metrics like "Today's Enrollments," "Last 7 Days Renewals," and "Currently Active Students."

#### **3. Primary Metrics Row (Date-Range Dependent)**
Key performance indicators for the selected date range, displayed as clickable cards with informational tooltips (ℹ️).

- **🟢 New Enrollments**: Total new students enrolled within the date range.
- **🟡 Eligible for Renewal**: Students whose subscription end date falls within the date range.
- **🔵 Renewals**: Total renewals processed within the date range.
- **🔴 Churned Students**: Students whose subscription ended in the date range and did not renew within the 45-day grace period.
- **🟠 In Grace Period**: Students whose subscription has expired but are currently within the 45-day grace period.
- **🟣 Multi-Course Students**: Students who enrolled in more than one course within the date range.

#### **3. Percentage Metrics Row**
Four key calculated metrics with informational tooltips (ℹ️).

- **Renewal %**: `(Renewals ÷ Eligible for Renewal) × 100`
- **Churn %**: `(Churned Students ÷ Active Students at Start) × 100`
- **Retention %**: 100 - Churn %
- **Net Growth %**: `((End Students - Start Students) ÷ Start Students) × 100`

#### **5. Monthly Trends Chart**
Line chart displaying:
- New Enrollments per month
- Renewals per month
- Churned Students per month

#### **6. Category & Activity Analysis**
- **Students by Activity Count**: Doughnut chart showing the distribution of single vs. multi-course students.
- **Enrollments and Renewals by Course Category**: Bar chart comparing enrollments and renewals for the top categories.

#### **7. Data Tables**
- **Top Course Categories by Enrollment**: Table ranking categories by total enrollments and renewals.
- **Course Categories with Highest Churned students**: Table ranking categories by the number of churned students.

## Business Logic

### **Student Data Merging**
- **Unified Student Profile**: Student records with similar IDs (e.g., `ID-KB-123` and `ID-GT-123`) are merged into a single profile.
- **Combined Data**: The merged profile aggregates all `activities` and `courseCategories`, uses the latest `endDate` and `enrollmentDate`, and de-duplicates all `renewalDates`.

### **Active Student Calculation**
A student is considered "active" at a given point in time if:
- Their subscription `endDate` has not passed yet, OR
- They are within the 45-day grace period and have not yet renewed, OR
- Their package is a lifetime ("LTV") package.

### **Renewal Window & Grace Period**
- **Grace Period**: 45 days after package expiration date
- **Valid Renewal**: A renewal is considered valid only if its date is *after* the subscription's `endDate`.
- **Churned**: A student is churned if their grace period has expired and they have no valid renewal.

### **Churn Calculation Logic**
The main Churn % metric is calculated for the selected date range:
- **Start**: Number of active students at the `startDate` of the date range.
- **Churned**: Number of students who churned within the date range.
- **Joined**: New enrollments within the date range.
- **End**: `Start + Joined - Churned`.
- **Churn %**: `(Churned ÷ Start) × 100`.

## Data Sources

### **Google Sheets Integration**
- **Enrollment Data**: `FormResponses1`, `OldFormResponses1`, `RazorpayEnrollments` sheets.
- **Renewal Data**: `Renewal`, `HistoricalRenewal`, `RazorpayRenewals` sheets.
- **Real-time API**: Fetches data from both sheets and combines student records

## Interactive Features

### **Clickable Metrics**
- All primary metric cards are clickable and open a modal with a detailed student list.
- **Informational Tooltips**: Each metric card has an `ℹ️` icon that shows a description or formula on hover/click.
- **Student Detail Modals**: Show comprehensive information including:
  - Contact details (email, phone)
  - Package information
  - A complete history of enrollment and renewal dates
  - Current status with color-coded badges
  - Lifetime value contribution

### **Drill-Downs**
- Clicking a course category in the tables opens a modal showing the list of students for that specific category.

## Technical Architecture

### **Tech Stack**
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Chart.js for all charts
- **Data Processing**: Custom utility classes
- **Icons**: Lucide React
- **Date Handling**: date-fns

### **Key Components**
- `UnifiedDataProcessor`: Core business logic and calculations
- `useStudentData`: Custom hook for fetching and processing data from Google Sheets.
- `DateRangeFilter`: Date selection component
-`CourseCategoryFilter`: Multi-select component for filtering by category.
- `UnifiedStudentModal` & `RenewalModal`: Popups for displaying student lists.
- `ClickableMetricCard`: Interactive KPI cards
- `InfoTooltip`: Reusable component for informational popups.

### **Data Flow**
1. **Data Fetching**: `useStudentData` hook fetches data from multiple Google Sheets.
2. **Data Merging**: `UnifiedDataProcessor.mergeStudentRecords` combines records for the same student into a single profile.
3. **State Management**: React hooks (`useState`, `useMemo`) manage filters, modal states, and derived data.
4. **Metric Calculation**: `UnifiedDataProcessor` calculates all metrics based on filtered data and the selected date range.
5. **UI Rendering**: Components render the processed data, responding dynamically to filter changes.

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

The dashboard provides a complete 360° view of student analytics, enabling data-driven decisions for student retention, activity optimization, and business growth.