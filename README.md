# Student Enrollment Dashboard

A comprehensive React dashboard for analyzing student enrollment data, renewals, and activity tracking using Google Sheets as the data source.

## Features

- **Real-time Data**: Connects to Google Sheets API for live data updates
- **Comprehensive Analytics**: 
  - Monthly enrollment trends
  - Activity-based enrollment analysis
  - Multi-activity student tracking
  - Renewal rate calculations
  - Drop-off rate analysis
- **Interactive Visualizations**: Line charts, bar charts, and doughnut charts
- **Responsive Design**: Optimized for all device sizes
- **Customizable Time Periods**: Quarter, year, or custom date ranges
- **Strike-off Detection**: Automatically identifies inactive students

## Setup Instructions

### 1. Google Sheets API Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create credentials (API Key)
5. Copy the API key

### 2. Prepare Your Google Sheet

Your Google Sheet should have the following columns (in order):
- Column A: Student ID
- Column B: Student Name
- Column C: Email
- Column D: Phone
- Column E: Activities (comma-separated)
- Column F: Enrollment Date
- Column G: Last Renewal Date
- Column H: Status (Active/Inactive)
- Column I: Fees
- Column J: Notes

### 3. Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your Google Sheets API key and Sheet ID:
   ```
   VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
   VITE_GOOGLE_SHEET_ID=your_sheet_id_here
   ```

### 4. Installation and Running

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Data Format

The dashboard expects data in the following format:

| Student ID | Name | Email | Phone | Activities | Enrollment Date | Last Renewal | Status | Fees | Notes |
|------------|------|-------|-------|------------|-----------------|--------------|--------|------|-------|
| STU001 | John Doe | john@email.com | +1-555-0123 | Swimming,Piano | 2023-01-15 | 2023-07-15 | Active | 250 | VIP |

### Strike-off Detection

Students are considered inactive/dropped when:
- The row has strike-through formatting (detected in processing)
- Status column shows "Inactive"
- The `isStrikeOff` flag is set to true

## Dashboard Metrics

### Key Performance Indicators
- **Active Students**: Current number of active students
- **New Enrollments**: Students enrolled in the last 3 years
- **Total Renewals**: Number of students who have renewed
- **Renewal Rate**: Percentage of students who renewed in the selected period
- **Drop-off Rate**: Percentage of students who became inactive
- **Multi-Activity Students**: Students enrolled in multiple activities

### Visualizations
- **Monthly Trends**: Line chart showing enrollments, renewals, and drop-offs over time
- **Activity Analysis**: Bar chart comparing enrollments and renewals by activity
- **Activity Distribution**: Doughnut chart showing single vs multi-activity students
- **Top Activities**: Table of most popular activities
- **High Drop-rate Activities**: Table of activities with highest attrition

## Customization

### Adding New Metrics
1. Update the `DashboardMetrics` interface in `src/types/Student.ts`
2. Add calculation logic in `src/utils/dataProcessor.ts`
3. Create a new `MetricCard` in the main App component

### Modifying Data Processing
Edit `src/services/googleSheetsApi.ts` to change how data is parsed from Google Sheets.

### Styling
The dashboard uses Tailwind CSS. Modify classes in components or update the theme in `tailwind.config.js`.

## Demo Mode

The dashboard includes mock data for demonstration purposes when Google Sheets API is not configured. This allows you to see all features without setting up the API initially.

## Troubleshooting

### Common Issues

1. **API Key Issues**: Ensure your API key has Google Sheets API enabled
2. **Sheet Access**: Make sure your Google Sheet is publicly readable or properly shared
3. **Data Format**: Check that your sheet follows the expected column structure
4. **CORS Issues**: The Google Sheets API should handle CORS automatically

### Error Handling

The dashboard includes comprehensive error handling:
- Network errors fall back to demo data
- Invalid data is logged with warnings
- User-friendly error messages guide troubleshooting

## Performance

- Data is cached and only refetched when explicitly requested
- Charts are optimized with Chart.js for smooth rendering
- Responsive design ensures good performance on mobile devices

## Security

- API keys are stored in environment variables
- No sensitive data is processed client-side beyond what's in the sheet
- All API calls are made over HTTPS