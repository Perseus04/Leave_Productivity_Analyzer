import mysql from "mysql2/promise";

/* Helper to convert Excel time to SQL TIME */
function excelTimeToSQL(time) {
  if (!time) return null;
  if (typeof time === "number") {
    const totalMinutes = Math.round(time * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}:00`;
  }
  if (typeof time === "string") {
    return time.includes(":") ? (time.length === 5 ? `${time}:00` : time) : null;
  }
  return null;
}

/* Helper to convert Excel date to YYYY-MM-DD */
function excelDateToSQL(dateVal) {
  if (!dateVal) return null;
  let date;
  if (typeof dateVal === "number") {
    date = new Date((dateVal - 25569) * 86400 * 1000);
  } else {
    date = new Date(dateVal);
  }
  return date.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const records = req.body; // expect array from frontend
    if (!Array.isArray(records) || records.length === 0)
      return res.status(400).json({ error: "Invalid or empty data" });

    const db = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    }).promise();

    let successCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      try {
        const employeeName = r["Employee Name"] || r.EmployeeName || r.employee_name;
        const workDate = excelDateToSQL(r["Date"] || r.date);
        const inTime = excelTimeToSQL(r["In-Time"] || r.InTime || r.in_time);
        const outTime = excelTimeToSQL(r["Out-Time"] || r.OutTime || r.out_time);

        let workedHours = 0;
        let isLeave = true;

        if (inTime && outTime) {
          workedHours = (new Date(`1970-01-01T${outTime}`) - new Date(`1970-01-01T${inTime}`)) / 3600000;
          isLeave = false;
        }

        await db.execute(
          `INSERT INTO attendance 
           (employee_name, work_date, in_time, out_time, worked_hours, is_leave)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE in_time=VALUES(in_time), out_time=VALUES(out_time),
           worked_hours=VALUES(worked_hours), is_leave=VALUES(is_leave)`,
          [employeeName, workDate, inTime, outTime, parseFloat(workedHours.toFixed(2)), isLeave]
        );

        successCount++;
      } catch (err) {
        errors.push({ record: i + 1, error: err.message });
      }
    }

    res.status(errors.length ? 207 : 200).json({ successCount, errors });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
}
