import mysql from "mysql2/promise";

/*
  GET /api/attendance
  Returns:
  {
    employees: {
      "EMP001": {
        "2024-01": { stats },
        "2024-02": { stats }
      }
    }
  }
*/

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Create a pooled connection (better for serverless)
    const db = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }).promise();

    const [rows] = await db.execute(`
      SELECT employee_id, employee_name, work_date, in_time, out_time
      FROM attendance
      ORDER BY employee_id, work_date
    `);

    const result = {};

    for (const row of rows) {
      const empId = row.employee_id || row.employee_name; // fallback if no ID
      const empName = row.employee_name;

      const dateObj = new Date(row.work_date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1; // 1-12
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;

      if (!result[empId]) result[empId] = {};
      if (!result[empId][monthKey]) {
        result[empId][monthKey] = {
          employeeName: empName,
          year,
          month,
          expectedHours: 0,
          actualHours: 0,
          leavesUsed: 0,
          workingDays: 0,
          daily: []
        };
      }

      const day = dateObj.getDay(); // 0 = Sunday
      let expected = 0;
      if (day >= 1 && day <= 5) expected = 8.5; // Mon-Fri
      else if (day === 6) expected = 4; // Saturday

      if (expected > 0) {
        result[empId][monthKey].expectedHours += expected;
        result[empId][monthKey].workingDays++;
      }

      let worked = 0;
      let isLeave = false;

      if (!row.in_time || !row.out_time) {
        if (expected > 0) {
          result[empId][monthKey].leavesUsed++;
          isLeave = true;
        }
      } else {
        const inTime = new Date(`1970-01-01T${row.in_time}`);
        const outTime = new Date(`1970-01-01T${row.out_time}`);
        worked = (outTime - inTime) / (1000 * 60 * 60);
        if (worked < 0) worked = 0;
        result[empId][monthKey].actualHours += worked;
      }

      result[empId][monthKey].daily.push({
        date: dateObj.toISOString().split("T")[0], // formatted YYYY-MM-DD
        expectedHours: expected,
        workedHours: worked,
        leave: isLeave
      });
    }

    // Calculate productivity per month
    for (const emp in result) {
      for (const m in result[emp]) {
        const r = result[emp][m];
        r.productivity =
          r.expectedHours > 0
            ? ((r.actualHours / r.expectedHours) * 100).toFixed(2)
            : "0.00";
      }
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("Attendance API Error:", err);
    res.status(500).json({ error: "Failed to load attendance data" });
  }
}
