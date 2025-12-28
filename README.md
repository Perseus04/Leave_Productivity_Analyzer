# Leave & Productivity Analyzer

A full-stack web application that analyzes employee attendance, leave usage, and productivity based on uploaded Excel attendance sheets.

## Features

- Excel File Upload: Upload .xlsx files with employee attendance data
- Automatic Calculations: Calculates worked hours, leaves, and productivity
- Interactive Dashboard: View monthly statistics and daily breakdowns
- Business Rules Compliance: 
  - Monday-Friday: 8.5 hours (10:00 AM - 6:30 PM)
  - Saturday: 4 hours (10:00 AM - 2:00 PM)
  - Sunday: Off
  - 2 leaves allowed per month

## Tech Stack

- Frontend: HTML, JavaScript
- Styling: CSS
- Excel Parsing: ExcelJS

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000] in your browser

## Excel File Format

Your Excel file should have the following columns:

| Employee Name | Date       | In-Time | Out-Time |
|---------------|------------|---------|----------|
| John Doe      | 2024-12-01 | 10:00   | 18:30    |
| John Doe      | 2024-12-02 | 10:15   | 18:45    |
| John Doe      | 2024-12-03 |         |          |

Note: Missing In-Time/Out-Time indicates a leave day.

## Metrics Calculated

- Total Expected Hours: Based on working days in the month
- Total Actual Hours: Sum of all worked hours
- Leaves Used: Number of working days with missing attendance
- Productivity: (Actual Hours / Expected Hours) × 100

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Click Deploy

## 📝 Sample Data

A sample Excel file is included in the repository (`excelTest/Attendance_Record.xlsx`) for testing purposes.


