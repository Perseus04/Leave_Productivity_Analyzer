let excelRows = [];

// FORMATING EXCEL DATE AND TIME

function formatDate(value) {
    let d;
    if (typeof value === "number") {
        d = new Date((value - 25569) * 86400 * 1000);
    } else {
        d = new Date(value);
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatTime(value) {
    if (typeof value === "number") {
        const totalMinutes = Math.round(value * 24 * 60);
        const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
        const m = String(totalMinutes % 60).padStart(2, "0");
        return `${h}:${m}`;
    }
    if (typeof value === "string" && value.includes(":")) {
        const [h, m] = value.split(":");
        return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    }
    return "-";
}

// LOAD & PREVIEW FUNCTIONALITY

function loadExcel() {
    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Select Excel file");

    const reader = new FileReader();
    reader.onload = e => {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true });
        renderPreview(excelRows);
        document.getElementById("status").innerText = "Preview loaded ✔";
    };
    reader.readAsBinaryString(file);
}

function renderPreview(rows) {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    head.innerHTML = "";
    body.innerHTML = "";

    if (!rows.length) return;

    const headers = Object.keys(rows[0]);

    head.innerHTML = `
        <tr>
            ${headers.map(h => `<th>${h}</th>`).join("")}
            <th>Worked Hours</th>
            <th>Status</th>
        </tr>`;

    rows.forEach(r => {
        let worked = 0;
        let status = "Leave";

        if (r["In-Time"] && r["Out-Time"]) {
            const inT = new Date(`1970-01-01T${formatTime(r["In-Time"])}`);
            const outT = new Date(`1970-01-01T${formatTime(r["Out-Time"])}`);
            worked = ((outT - inT) / 3600000).toFixed(2);
            status = "Present";
        }

        body.innerHTML += `
            <tr>
                ${headers.map(h => {
                    if (h.toLowerCase().includes("date"))
                        return `<td>${formatDate(r[h])}</td>`;
                    if (h.toLowerCase().includes("in") || h.toLowerCase().includes("out"))
                        return `<td>${formatTime(r[h])}</td>`;
                    return `<td>${r[h] ?? "-"}</td>`;
                }).join("")}
                <td>${worked}</td>
                <td>${status}</td>
            </tr>`;
    });
}

// UPLOAD

async function uploadExcel() {
    if (!excelRows.length) {
        alert("Preview Excel first");
        return;
    }

    document.getElementById("status").innerText = "Uploading...";

    try {
        const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(excelRows)
        });

        const data = await res.json();

        if (!res.ok) {
            document.getElementById("status").innerText =
                "Upload failed ❌ : " + data.error;
            console.error(data.error);
            return;
        }

        document.getElementById("status").innerText =
            "Upload successful ✔";

    } catch (err) {
        document.getElementById("status").innerText =
            "Server not reachable ❌";
        console.error(err);
    }
}
