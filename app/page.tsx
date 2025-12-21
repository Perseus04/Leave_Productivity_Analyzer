'use client';

import React, { useState } from 'react';
import { Upload, Calendar, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AttendanceRecord {
  date: string;
  inTime: string;
  outTime: string;
  workedHours: string;
  expectedHours: number;
  isLeave: boolean;
}

export default function Home() {
  const [employees, setEmployees] = useState<Record<string, AttendanceRecord[]>>({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const businessRules = {
    weekdayHours: 8.5,
    saturdayHours: 4,
    leavesPerMonth: 2,
    workStart: '10:00',
    workEndWeekday: '18:30',
    workEndSaturday: '14:00'
  };

  const calculateWorkedHours = (inTime: string, outTime: string): number => {
    if (!inTime || !outTime) return 0;
    
    const inDate = new Date(`2000-01-01 ${inTime}`);
    const outDate = new Date(`2000-01-01 ${outTime}`);
    
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;
    
    const diffMs = outDate.getTime() - inDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  };

  const getExpectedHours = (date: string): number => {
    const day = new Date(date).getDay();
    if (day === 0) return 0; // Sunday
    if (day === 6) return businessRules.saturdayHours; // Saturday
    return businessRules.weekdayHours; // Monday-Friday
  };

  const isWorkingDay = (date: string): boolean => {
    const day = new Date(date).getDay();
    return day !== 0; // Not Sunday
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        processAttendanceData(jsonData);
        setUploadStatus('success');
      } catch (error) {
        setUploadStatus('error');
        console.error('Error parsing Excel:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processAttendanceData = (data: any[]) => {
    const employeeData: Record<string, AttendanceRecord[]> = {};

    data.forEach(row => {
      const empName = row['Employee Name'] || row['EmployeeName'] || row['employee_name'];
      const date = row['Date'] || row['date'];
      const inTime = row['In-Time'] || row['InTime'] || row['in_time'];
      const outTime = row['Out-Time'] || row['OutTime'] || row['out_time'];

      if (!empName || !date) return;

      if (!employeeData[empName]) {
        employeeData[empName] = [];
      }

      const dateStr = typeof date === 'number' 
        ? XLSX.SSF.format('yyyy-mm-dd', date)
        : new Date(date).toISOString().split('T')[0];

      const workedHours = calculateWorkedHours(inTime, outTime);
      const expectedHours = getExpectedHours(dateStr);
      const isLeave = isWorkingDay(dateStr) && (!inTime || !outTime);

      employeeData[empName].push({
        date: dateStr,
        inTime: inTime || '-',
        outTime: outTime || '-',
        workedHours: workedHours.toFixed(2),
        expectedHours,
        isLeave
      });
    });

    // Sort by date
    Object.keys(employeeData).forEach(emp => {
      employeeData[emp].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    setEmployees(employeeData);
    
    // Set defaults
    if (Object.keys(employeeData).length > 0) {
      setSelectedEmployee(Object.keys(employeeData)[0]);
      
      const dates = employeeData[Object.keys(employeeData)[0]].map(d => d.date);
      if (dates.length > 0) {
        const monthYear = dates[0].substring(0, 7);
        setSelectedMonth(monthYear);
      }
    }
  };

  const getMonthlyStats = () => {
    if (!selectedEmployee || !selectedMonth || !employees[selectedEmployee]) {
      return null;
    }

    const records = employees[selectedEmployee].filter(r => 
      r.date.startsWith(selectedMonth)
    );

    const totalExpected = records.reduce((sum, r) => sum + r.expectedHours, 0);
    const totalWorked = records.reduce((sum, r) => sum + parseFloat(r.workedHours), 0);
    const leavesUsed = records.filter(r => r.isLeave).length;
    const productivity = totalExpected > 0 ? (totalWorked / totalExpected) * 100 : 0;

    return {
      totalExpected: totalExpected.toFixed(2),
      totalWorked: totalWorked.toFixed(2),
      leavesUsed,
      leavesRemaining: Math.max(0, businessRules.leavesPerMonth - leavesUsed),
      productivity: productivity.toFixed(2),
      records
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadStatus('uploading');
      parseExcelFile(file);
    }
  };

  const stats = getMonthlyStats();
  const availableMonths = selectedEmployee && employees[selectedEmployee]
    ? [...new Set(employees[selectedEmployee].map(r => r.date.substring(0, 7)))].sort()
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                <TrendingUp className="text-indigo-600" />
                Leave & Productivity Analyzer
            </h1>
            <p className="text-gray-600">Track employee attendance, leaves, and productivity</p>
            </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
                <Upload className="text-indigo-600" />
                <h2 className="text-xl font-semibold text-gray-800">Upload Attendance Data</h2>
            </div>
          
            <div className="border-2 border-dashed border-indigo-300 rounded-lg p-8 text-center">
                <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                        <Upload className="w-12 h-12 text-indigo-400" />
                        <p className="text-gray-700 font-medium">Click to upload Excel file</p>
                        <p className="text-sm text-gray-500">Supports .xlsx and .xls formats</p>
                    </div>
                </label>
            </div>

        {uploadStatus === 'success' && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>File uploaded successfully! {Object.keys(employees).length} employee(s) found.</span>
            </div>
          )}
          
        {uploadStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>Error uploading file. Please check the format.</span>
            </div>
          )}
        </div>

        {/* Filters */}
        {Object.keys(employees).length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Employee
                </label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {Object.keys(employees).map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {availableMonths.map(month => (
                    <option key={month} value={month}>
                      {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        {stats && (
          <>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-sm text-gray-600">Expected Hours</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalExpected}h</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-sm text-gray-600">Actual Hours</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalWorked}h</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-sm text-gray-600">Leaves Used</p>
                <p className="text-2xl font-bold text-gray-800">
                  {stats.leavesUsed} / {businessRules.leavesPerMonth}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-sm text-gray-600">Productivity</p>
                <p className="text-2xl font-bold text-gray-800">{stats.productivity}%</p>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Daily Attendance Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left p-3 text-gray-700 font-semibold">Date</th>
                      <th className="text-left p-3 text-gray-700 font-semibold">In-Time</th>
                      <th className="text-left p-3 text-gray-700 font-semibold">Out-Time</th>
                      <th className="text-left p-3 text-gray-700 font-semibold">Worked Hours</th>
                      <th className="text-left p-3 text-gray-700 font-semibold">Expected Hours</th>
                      <th className="text-left p-3 text-gray-700 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.records.map((record, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          {new Date(record.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </td>
                        <td className="p-3">{record.inTime}</td>
                        <td className="p-3">{record.outTime}</td>
                        <td className="p-3">{record.workedHours}h</td>
                        <td className="p-3">{record.expectedHours}h</td>
                        <td className="p-3">
                          {record.isLeave ? (
                            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                              Leave
                            </span>
                          ) : record.expectedHours === 0 ? (
                            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                              Off
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              Present
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Instructions */}
        {Object.keys(employees).length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">How to Use</h2>
            <div className="space-y-3 text-gray-600">
              <p>1. Prepare an Excel file with columns: <strong>Employee Name, Date, In-Time, Out-Time</strong></p>
              <p>2. Upload the file using the upload button above</p>
              <p>3. Select an employee and month to view their attendance and productivity metrics</p>
              <p className="mt-4 p-3 bg-blue-50 rounded-lg">
                <strong>Business Rules:</strong> Monday-Friday: 8.5h (10:00-18:30), Saturday: 4h (10:00-14:00), 
                Sunday: Off, 2 leaves allowed per month
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}