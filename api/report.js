import mysql from "mysql2/promise";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const month = req.query.month;
    if (!month) {
      return res.status(400).json({ error: "Month parameter required (format: YYYY-MM)" });
    }

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

    // Total worked hours and leaves
    const [rows] = await db.execute(
      `SELECT 
          SUM(worked_hours) AS actual,
          SUM(is_leave) AS leaves
       FROM attendance
       WHERE DATE_FORMAT(work_date, '%Y-%m') = ?`,
      [month]
    );

    // Get all days in this month
    const [days] = await db.execute(
      `SELECT work_date FROM attendance 
       WHERE DATE_FORMAT(work_date,'%Y-%m')=?`,
      [month]
    );

    // Calculate expected hours
    let expected = 0;
    days.forEach(d => {
      const day = new Date(d.work_date).getDay();
      if (day >= 1 && day <= 5) expected += 8.5; // Mon-Fri
      else if (day === 6) expected += 4; // Saturday
    });

    const actual = parseFloat(rows[0].actual) || 0;
    const leaves = parseInt(rows[0].leaves) || 0;
    const productivity = expected > 0 ? ((actual / expected) * 100).toFixed(2) : "0.00";

    res.status(200).json({
      expected: expected.toFixed(2),
      actual: actual.toFixed(2),
      leaves,
      productivity
    });

  } catch (err) {
    console.error("Report API Error:", err);
    res.status(500).json({ error: "Failed to generate report", details: err.message });
  }
}
