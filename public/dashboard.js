let attendanceData = [];

const employeeSelect = document.getElementById("employeeSelect");
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");

// FETCH DATA

fetch("/api/attendance")
    .then(res => res.json())
    .then(data => {
        attendanceData = data;
        populateEmployees();
    })
    .catch(err => console.error("Fetch error:", err));

// EMPLOYEES

function populateEmployees() {
    const employees = [...new Set(
        attendanceData.map(r => r.employee_name).filter(Boolean)
    )];

    employeeSelect.innerHTML = `<option value="">Select Employee</option>`;

    employees.forEach(emp => {
        const opt = document.createElement("option");
        opt.value = emp;
        opt.textContent = emp;
        employeeSelect.appendChild(opt);
    });
}

// EVENTS

employeeSelect.addEventListener("change", () => {
    resetSelect(yearSelect, "Select Year");
    resetSelect(monthSelect, "Select Month");

    if (!employeeSelect.value) return;
    populateYears(employeeSelect.value);
});

yearSelect.addEventListener("change", () => {
    resetSelect(monthSelect, "Select Month");

    if (!yearSelect.value) return;
    populateMonths(employeeSelect.value, yearSelect.value);
});

monthSelect.addEventListener("change", () => {
    if (!monthSelect.value) return;

    updateDashboard(
        employeeSelect.value,
        yearSelect.value,
        monthSelect.value
    );
});

// YEAR

function populateYears(employee) {
    const years = [...new Set(
        attendanceData
            .filter(r => r.employee_name === employee)
            .map(r => new Date(r.work_date).getFullYear())
    )].sort((a, b) => b - a);

    years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
}

// MONTH

function populateMonths(employee, year) {
    const months = [...new Set(
        attendanceData
            .filter(r =>
                r.employee_name === employee &&
                new Date(r.work_date).getFullYear() == year
            )
            .map(r => new Date(r.work_date).getMonth() + 1)
    )].sort((a, b) => a - b);

    months.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = monthName(m);
        monthSelect.appendChild(opt);
    });
}

// DASHBOARD

function updateDashboard(employee, year, month) {
    const rows = attendanceData.filter(r => {
        const d = new Date(r.work_date);
        return (
            r.employee_name === employee &&
            d.getFullYear() == year &&
            d.getMonth() + 1 == month
        );
    });

    buildDashboard(rows);
}

function buildDashboard(rows) {
    let expected = 0;
    let worked = 0;
    let leaves = 0;

    const body = document.getElementById("tableBody");
    body.innerHTML = "";

    rows.forEach(r => {
        const date = new Date(r.work_date);
        const day = date.getDay();

        let expectedToday = 0;
        if (day >= 1 && day <= 5) expectedToday = 8.5;
        if (day === 6) expectedToday = 4;

        expected += expectedToday;

        if (!r.is_leave) {
            worked += Number(r.worked_hours);
        } else if (expectedToday > 0) {
            leaves++;
        }

        body.innerHTML += `
            <tr>
                <td>${formatDate(date)}</td>
                <td>${date.toLocaleDateString("en-US",{weekday:"short"})}</td>
                <td>${r.in_time || "-"}</td>
                <td>${r.out_time || "-"}</td>
                <td>${r.worked_hours}</td>
                <td>${r.is_leave ? "Leave" : "Present"}</td>
            </tr>`;
    });

    document.getElementById("expected").innerText = expected.toFixed(2);
    document.getElementById("worked").innerText = worked.toFixed(2);
    document.getElementById("leaves").innerText = `${leaves} / 2`;

    const productivity =
        expected > 0 ? ((worked / expected) * 100).toFixed(2) : 0;

    document.getElementById("productivity").innerText =
        productivity + "%";
}

// DROPDOWN MONTHS

function monthName(m) {
    const map = {
        1: "January", 2: "February", 3: "March", 4: "April",
        5: "May", 6: "June", 7: "July", 8: "August",
        9: "September", 10: "October", 11: "November", 12: "December"
    };
    return map[m];
}

function formatDate(d) {
    return `${String(d.getDate()).padStart(2,"0")}/` +
           `${String(d.getMonth()+1).padStart(2,"0")}/` +
           d.getFullYear();
}

function resetSelect(sel, label) {
    sel.innerHTML = `<option value="">${label}</option>`;
}
