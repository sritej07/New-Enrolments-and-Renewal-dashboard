## Project Overview

This is a React-based Student Enrollment Dashboard that analyzes student enrollment data, renewals, and activity tracking using Google Sheets as the data source. The dashboard provides comprehensive analytics including enrollment trends, renewal rates, drop-off analysis, and multi-activity student tracking.

## Development Commands

### Essential Commands
- `npm install` - Install all dependencies
- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

### Development Environment Setup
1. Copy environment variables:
   - Create `.env` file in project root
   - Add required variables:
     ```
     VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
     VITE_GOOGLE_SHEET_ID=your_sheet_id_here
     VITE_SHEET_NAME=Sheet1
     ```

2. Google Sheets API Setup:
   - Enable Google Sheets API in Google Cloud Console
   - Create API key credentials
   - Ensure sheet is publicly readable or properly shared

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Chart.js with react-chartjs-2
- **Data Processing**: Custom utility classes
- **API Integration**: Axios for Google Sheets API
- **Icons**: Lucide React
- **Date Handling**: date-fns

### Key Architecture Patterns

#### Data Flow
1. **Data Source**: Google Sheets API via `googleSheetsService`
2. **Data Processing**: `DataProcessor` utility class transforms raw data into metrics
3. **State Management**: Custom React hook `useStudentData` manages fetching and caching
4. **UI Layer**: Component-based architecture with reusable chart components

#### Core Components Architecture
- **App.tsx**: Main dashboard orchestrator, handles data aggregation and chart configuration
- **DataProcessor**: Static utility class for all analytics calculations
- **GoogleSheetsService**: Handles API communication and data parsing
- **useStudentData**: Custom hook managing data fetching, loading states, and error handling

#### Component Structure
```
src/
├── components/           # Reusable UI components
│   ├── charts/          # Chart-specific components (Line, Bar, Doughnut)
│   ├── MetricCard.tsx   # KPI display component
│   ├── FilterPanel.tsx  # Time period filtering
│   └── ActivityTable.tsx # Activity data tables
├── hooks/               # Custom React hooks
├── services/            # External API services
├── types/              # TypeScript interfaces
└── utils/              # Business logic utilities
```

### Data Model

#### Student Interface
The core data model revolves around the `Student` interface:
- Supports multiple activities per student
- Tracks enrollment and renewal dates
- Handles active/inactive status and strike-off detection
- Flexible fields for fees and notes

#### Key Metrics Calculated
- Active student count and new enrollments (last 3 years)
- Renewal rates with configurable time periods (quarter/year/custom)
- Drop-off rate analysis
- Multi-activity student tracking
- Activity-specific enrollment and renewal metrics
# Drop-off and Renewal Rate Calculation

## Renewal Rate

### Logic

-   A student is considered **renewed** if they have:
    -   More than one enrollment record, OR
    -   A valid `lastRenewalDate` that is later than the
        `enrollmentDate`.

### Formula

\`\`\` Renewal Rate (%) = (Renewed Students ÷ Total Students) × 100
\`\`\`

### Example

-   Total students: 100\
-   Renewed students: 60

\`\`\` Renewal Rate = (60 ÷ 100) × 100 = 60% \`\`\`

------------------------------------------------------------------------

## Drop-off Rate

### Logic

-   A student is considered **dropped** if their latest row in Google
    Sheets has column **V** marked as `STRIKE`.
-   Drop-offs are attributed to the month of their **last renewal** (or
    enrollment if no renewal).

### Formula (Overall)

\`\`\` Drop-off Rate (%) = (Dropped Students ÷ Total Students) × 100
\`\`\`

### Formula (Activity-wise)

\`\`\` Drop Rate (%) = (Dropped in Activity ÷ Enrolled in Activity) ×
100 \`\`\`

### Example (Overall)

-   Total students: 100\
-   Dropped students: 20

\`\`\` Drop-off Rate = (20 ÷ 100) × 100 = 20% \`\`\`

### Example (Activity-wise)

-   Enrolled in Dance: 50\
-   Dropped in Dance: 10

\`\`\` Drop Rate (Dance) = (10 ÷ 50) × 100 = 20% \`\`\`


### Data Processing Logic

#### Monthly Trend Analysis
- Generates time-series data for configurable periods
- Tracks new enrollments, renewals, and drop-offs by month
- Uses date-fns for robust date calculations

#### Activity Analytics
- Processes student activities (comma-separated in sheets)
- Calculates enrollment counts, renewal rates, and drop-off rates per activity
- Identifies top-performing and high-risk activities

#### Renewal Rate Calculations
- Supports multiple time period filters (quarter, year, custom months)
- Calculates rates based on students enrolled before period start
- Provides both overall and period-specific renewal metrics

## Important Configuration Files

### Vite Configuration (`vite.config.ts`)
- Optimizes lucide-react by excluding from pre-bundling
- Uses standard React plugin setup

### ESLint Configuration (`eslint.config.js`)
- TypeScript ESLint configuration with React-specific rules
- Includes React Hooks and React Refresh plugins
- Ignores `dist` directory

### Tailwind Configuration (`tailwind.config.js`)
- Standard Tailwind setup scanning HTML and React files
- No custom theme extensions currently

## Data Source Requirements

### Google Sheets Format
Expected columns (in order):
- A: Student ID
- B: Student Name  
- C: Email
- D: Phone
- E: Activities (comma-separated)
- F: Enrollment Date
- G: Last Renewal Date
- H: Status (Active/Inactive)
- I: Fees
- J: Notes

### Strike-off Detection
Students are marked as dropped when:
- Row has strike-through formatting
- Status column shows "Inactive"
- Key fields are empty or contain strike indicators (`~~`)

## Development Notes

### Error Handling Strategy
- Graceful fallback to demo data when API fails
- Comprehensive error logging for data parsing issues
- User-friendly error messages with retry functionality

### Performance Considerations
- Data caching in `useStudentData` hook prevents unnecessary refetches
- Chart.js optimizations for smooth rendering
- Memoized calculations in main App component

### State Management Pattern
- Uses React's built-in state management with custom hooks
- No external state management library (Redux, Zustand) required
- Data fetching isolated in custom hook for reusability
