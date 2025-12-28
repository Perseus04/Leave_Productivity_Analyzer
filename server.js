require('dotenv').config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static("public"));

console.log("🔧 Database Configuration:");
console.log("   Host:", process.env.DB_HOST || "localhost");
console.log("   Port:", process.env.DB_PORT || 3306);
console.log("   User:", process.env.DB_USER || "root");
console.log("   Database:", process.env.DB_NAME || "leave_analyzer");

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "leave_analyzer",
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

// Test connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ DB CONNECTION FAILED:", err.message);
        console.error("   Code:", err.code);
        console.error("   SQL State:", err.sqlState);
        return;
    }
    console.log("✅ Connected to MySQL");
    
    // Test query
    connection.query("SELECT DATABASE() as db", (err, results) => {
        if (err) {
            console.error("❌ Test query failed:", err.message);
        } else {
            console.log("📊 Connected to database:", results[0].db);
        }
    });
    
    // Check if table exists
    connection.query("SHOW TABLES LIKE 'attendance'", (err, results) => {
        if (err) {
            console.error("❌ Cannot check tables:", err.message);
        } else if (results.length === 0) {
            console.error("❌ WARNING: 'attendance' table does NOT exist!");
            console.log("   Run this SQL to create it:");
            console.log(`
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50),
    employee_name VARCHAR(255) NOT NULL,
    work_date DATE NOT NULL,
    in_time TIME,
    out_time TIME,
    worked_hours DECIMAL(5,2) DEFAULT 0,
    is_leave BOOLEAN DEFAULT FALSE,
    UNIQUE KEY unique_attendance (employee_name, work_date)
);
            `);
        } else {
            console.log("✅ Table 'attendance' exists");
        }
    });
    
    connection.release();
});

/* HELPERS */

function excelTimeToSQL(time) {
    console.log("   Converting time:", time, "Type:", typeof time);
    
    if (!time || time === "" || time === null) {
        console.log("   → NULL (empty)");
        return null;
    }

    if (typeof time === "number") {
        const totalMinutes = Math.round(time * 24 * 60);
        const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
        const m = String(totalMinutes % 60).padStart(2, "0");
        const result = `${h}:${m}:00`;
        console.log("   → ", result);
        return result;
    }

    if (typeof time === "string") {
        if (time.includes(":")) {
            const result = time.length === 5 ? `${time}:00` : time;
            console.log("   → ", result);
            return result;
        }
    }

    console.log("   → NULL (unrecognized format)");
    return null;
}

function excelDateToSQL(dateVal) {
    console.log("   Converting date:", dateVal, "Type:", typeof dateVal);
    
    if (!dateVal) {
        console.log("   → NULL (empty)");
        return null;
    }
    
    let date;
    if (typeof dateVal === "number") {
        // Excel serial date
        date = new Date((dateVal - 25569) * 86400 * 1000);
    } else if (typeof dateVal === "string") {
        date = new Date(dateVal);
    } else {
        date = new Date(dateVal);
    }
    
    console.log("   → ", date.toISOString().split('T')[0]);
    return date;
}

/* API ROUTES */

/* Health Check */
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        timestamp: new Date().toISOString()
    });
});

/* Upload Excel Data */
app.post("/api/upload", async (req, res) => {
    console.log("\n═══════════════════════════════════════");
    console.log("📥 UPLOAD REQUEST RECEIVED");
    console.log("═══════════════════════════════════════");
    
    try {
        console.log("📊 Request body type:", typeof req.body);
        console.log("📊 Is Array:", Array.isArray(req.body));
        console.log("📊 Number of records:", req.body?.length);
        
        if (!Array.isArray(req.body)) {
            console.error("❌ Invalid data format - not an array");
            return res.status(400).json({ error: "Invalid data format - expected array" });
        }

        if (req.body.length === 0) {
            console.error("❌ No data to upload");
            return res.status(400).json({ error: "No data to upload" });
        }

        console.log("\n📋 FIRST RECORD:");
        console.log(JSON.stringify(req.body[0], null, 2));
        console.log("\n📋 ALL COLUMN NAMES:");
        console.log(Object.keys(req.body[0]));

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let index = 0; index < req.body.length; index++) {
            const r = req.body[index];
            
            console.log(`\n─────────────────────────────────────`);
            console.log(`📝 Processing Record ${index + 1}/${req.body.length}`);
            console.log(`─────────────────────────────────────`);
            
            try {
                const employeeName = r["Employee Name"] || r.EmployeeName || r.employee_name;
                console.log("👤 Employee Name:", employeeName);
                
                if (!employeeName || employeeName.trim() === "") {
                    throw new Error("Missing employee name");
                }

                console.log("📅 Date Processing:");
                const workDate = excelDateToSQL(r["Date"] || r.date);
                
                if (!workDate || isNaN(workDate.getTime())) {
                    throw new Error(`Invalid date: ${r["Date"] || r.date}`);
                }

                console.log("⏰ In-Time Processing:");
                const inTime = excelTimeToSQL(r["In-Time"] || r.InTime || r.in_time);
                
                console.log("⏰ Out-Time Processing:");
                const outTime = excelTimeToSQL(r["Out-Time"] || r.OutTime || r.out_time);

                let workedHours = 0;
                let isLeave = true;

                if (inTime && outTime) {
                    const inT = new Date(`1970-01-01T${inTime}`);
                    const outT = new Date(`1970-01-01T${outTime}`);
                    workedHours = ((outT - inT) / 3600000);
                    isLeave = false;
                    console.log("⏱️  Worked Hours:", workedHours.toFixed(2));
                } else {
                    console.log("🏖️  Leave Day (no times)");
                }

                console.log("\n💾 Inserting into database...");
                const sql = `INSERT INTO attendance
                    (employee_name, work_date, in_time, out_time, worked_hours, is_leave)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    in_time = VALUES(in_time),
                    out_time = VALUES(out_time),
                    worked_hours = VALUES(worked_hours),
                    is_leave = VALUES(is_leave)`;
                
                const params = [
                    employeeName.trim(),
                    workDate,
                    inTime,
                    outTime,
                    parseFloat(workedHours.toFixed(2)),
                    isLeave
                ];
                
                console.log("SQL:", sql);
                console.log("Parameters:", params);
                
                await db.execute(sql, params);
                
                console.log("✅ Record inserted successfully");
                successCount++;
                
            } catch (recordError) {
                console.error(`❌ Error on record ${index + 1}:`, recordError.message);
                console.error("   Stack:", recordError.stack);
                errorCount++;
                errors.push({
                    record: index + 1,
                    data: r,
                    error: recordError.message
                });
            }
        }

        console.log("\n═══════════════════════════════════════");
        console.log("📊 UPLOAD SUMMARY");
        console.log("═══════════════════════════════════════");
        console.log("✅ Success:", successCount);
        console.log("❌ Errors:", errorCount);
        console.log("═══════════════════════════════════════\n");

        if (errorCount > 0) {
            res.status(207).json({ 
                success: true,
                message: "Partial success",
                successCount,
                errorCount,
                errors 
            });
        } else {
            res.json({ 
                success: true, 
                count: successCount 
            });
        }

    } catch (err) {
        console.error("\n❌❌❌ CRITICAL UPLOAD ERROR ❌❌❌");
        console.error("Message:", err.message);
        console.error("Code:", err.code);
        console.error("SQL State:", err.sqlState);
        console.error("Stack:", err.stack);
        console.error("═══════════════════════════════════════\n");
        
        res.status(500).json({ 
            error: "DB insert failed", 
            details: err.message,
            code: err.code,
            sqlState: err.sqlState
        });
    }
});

/* Fetch Attendance for Dashboard */
app.get("/api/attendance", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT 
                employee_id, 
                employee_name, 
                work_date, 
                in_time, 
                out_time, 
                worked_hours, 
                is_leave, 
                YEAR(work_date) AS year, 
                MONTH(work_date) AS month 
            FROM attendance 
            ORDER BY employee_name, work_date`
        );
        res.json(rows);
    } catch (err) {
        console.error("FETCH ERROR:", err);
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
});

/* Monthly Report */
app.get("/api/report", async (req, res) => {
    try {
        const month = req.query.month;

        if (!month) {
            return res.status(400).json({ error: "Month parameter required (format: YYYY-MM)" });
        }

        const [rows] = await db.execute(
            `SELECT 
                SUM(worked_hours) as actual,
                SUM(is_leave) as leaves
             FROM attendance
             WHERE DATE_FORMAT(work_date, '%Y-%m') = ?`,
            [month]
        );

        const [days] = await db.execute(
            `SELECT work_date FROM attendance 
             WHERE DATE_FORMAT(work_date,'%Y-%m')=?`,
            [month]
        );

        let expected = 0;
        days.forEach(d => {
            const day = new Date(d.work_date).getDay();
            if (day >= 1 && day <= 5) expected += 8.5;
            else if (day === 6) expected += 4;
        });

        const actual = parseFloat(rows[0].actual) || 0;
        const productivity = expected > 0 ? ((actual / expected) * 100).toFixed(2) : "0.00";

        res.json({
            expected: expected.toFixed(2),
            actual: actual.toFixed(2),
            leaves: rows[0].leaves || 0,
            productivity
        });
    } catch (err) {
        console.error("REPORT ERROR:", err);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Server running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}\n`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    pool.end(() => {
        console.log('Database pool closed');
        process.exit(0);
    });
});