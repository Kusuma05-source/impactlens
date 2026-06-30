// Base rates for real-time calculations
const RATES = {
  "Waste Recycled": { rate: 0.75, unit: "kg" },
  "Sustainable Meals": { rate: 1.5, unit: "meals" },
  "Distance Biked": { rate: 0.21, unit: "km" },
  "Electricity Saved": { rate: 0.45, unit: "kWh" },
  "Water Saved": { rate: 0.002, unit: "L" }
};

document.addEventListener("DOMContentLoaded", () => {
  initFormDate();
  setupFormListeners();
});

// Set default activity date to today
function initFormDate() {
  const dateInput = document.getElementById("act-date");
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

// Wire up dropdown and input listeners
function setupFormListeners() {
  const categorySelect = document.getElementById("act-category");
  const qtyInput = document.getElementById("act-qty");
  const unitIndicator = document.getElementById("unit-indicator");
  const previewCO2 = document.getElementById("preview-co2");
  const submitBtn = document.getElementById("btn-submit");
  const form = document.getElementById("activity-form");

  if (!categorySelect || !qtyInput || !unitIndicator || !previewCO2 || !submitBtn || !form) return;

  // 1. Listen for category changes
  categorySelect.addEventListener("change", () => {
    const selection = categorySelect.value;
    const rateInfo = RATES[selection];
    
    if (rateInfo) {
      unitIndicator.textContent = rateInfo.unit;
      qtyInput.disabled = false;
      qtyInput.focus();
      
      // Keep calculation updated
      updateImpactPreview(qtyInput.value, rateInfo.rate, previewCO2);
      validateForm(categorySelect.value, qtyInput.value, submitBtn);
    }
  });

  // 2. Listen for quantity input changes
  qtyInput.addEventListener("input", () => {
    const selection = categorySelect.value;
    const rateInfo = RATES[selection];
    
    if (rateInfo) {
      updateImpactPreview(qtyInput.value, rateInfo.rate, previewCO2);
    }
    
    validateForm(categorySelect.value, qtyInput.value, submitBtn);
  });

  // 3. Handle submit button
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const category = categorySelect.value;
    const qty = parseFloat(qtyInput.value);
    const date = document.getElementById("act-date").value;
    const user = document.getElementById("act-user").value;
    
    if (!category || isNaN(qty) || qty <= 0 || !date || !user) {
      alert("Please fill out all fields correctly.");
      return;
    }

    const rateInfo = RATES[category];
    const newActivity = {
      id: `act-local-${Date.now()}`,
      date: date,
      activity: category,
      quantity: qty,
      unit: rateInfo.unit,
      loggedBy: user,
      team: "Lumen"
    };

    // Save to local storage
    saveActivityLocal(newActivity);
    
    // Redirect back to dashboard
    location.href = "dashboard.html";
  });
}

// Calculate and show impact preview
function updateImpactPreview(qtyString, rate, displayElement) {
  const qty = parseFloat(qtyString);
  if (isNaN(qty) || qty <= 0) {
    displayElement.textContent = "0.00";
    return;
  }
  
  const calculated = qty * rate;
  displayElement.textContent = calculated.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Form validation check
function validateForm(category, qtyString, btn) {
  const qty = parseFloat(qtyString);
  if (category && !isNaN(qty) && qty > 0) {
    btn.disabled = false;
  } else {
    btn.disabled = true;
  }
}

// Persistence handler
function saveActivityLocal(activity) {
  let localLogs = [];
  
  try {
    const stored = localStorage.getItem("impactlens_activities");
    if (stored) {
      localLogs = JSON.parse(stored);
    }
  } catch (err) {
    console.error("Error reading from localStorage:", err);
  }
  
  localLogs.push(activity);
  
  try {
    localStorage.setItem("impactlens_activities", JSON.stringify(localLogs));
    console.log("Logged activity successfully stored locally:", activity);
  } catch (err) {
    console.error("Error writing to localStorage:", err);
  }
}

// ============================================
// BULK CSV UPLOAD — Feature Module
// ============================================

(function initBulkCSVUpload() {

  // ---- Constants ----
  const VALID_ACTIVITIES = {
    "distance biked":     "Distance Biked",
    "waste recycled":     "Waste Recycled",
    "electricity saved":  "Electricity Saved",
    "water saved":        "Water Saved",
    "sustainable meals":  "Sustainable Meals"
  };

  const UNIT_MAP = {
    "Distance Biked":     "km",
    "Waste Recycled":     "kg",
    "Electricity Saved":  "kWh",
    "Water Saved":        "L",
    "Sustainable Meals":  "meals"
  };

  const EXPECTED_HEADERS = ["date", "activity", "quantity", "logged by"];

  // State for parsed data
  let parsedRows = [];

  // ---- Tab Switching ----
  document.querySelectorAll(".form-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      // Deactivate all tabs and panels
      document.querySelectorAll(".form-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(p => p.classList.remove("active"));

      // Activate clicked tab and its panel
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add("active");
    });
  });

  // ---- Upload Zone Elements ----
  const uploadZone = document.getElementById("upload-zone");
  const fileInput = document.getElementById("csv-file-input");
  const fileNameDisplay = document.getElementById("upload-file-name");
  const csvPreview = document.getElementById("csv-preview");
  const importBtn = document.getElementById("btn-import-all");
  const templateBtn = document.getElementById("btn-download-template");

  if (!uploadZone || !fileInput) return; // Guard: only run on form page

  // ---- Click to Browse ----
  uploadZone.addEventListener("click", () => fileInput.click());

  // ---- File Input Change ----
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // ---- Drag and Drop ----
  uploadZone.addEventListener("dragenter", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add("drag-over");
  });

  uploadZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove("drag-over");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  });

  // ---- Download Template ----
  if (templateBtn) {
    templateBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Don't trigger upload zone click
      const templateCSV = [
        "Date,Activity,Quantity,Logged By",
        "2026-07-01,Distance Biked,15,Kusuma",
        "2026-07-01,Waste Recycled,3.5,Elena Vance",
        "2026-07-02,Electricity Saved,12,Marcus Fenix",
        "2026-07-02,Water Saved,200,Sarah Connor",
        "2026-07-03,Sustainable Meals,4,Lumen Leader"
      ].join("\n");

      const blob = new Blob([templateCSV], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "impactlens_bulk_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // ---- Import All ----
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      if (parsedRows.length === 0) return;

      // Convert parsed rows to activity records and save
      let localLogs = [];
      try {
        const stored = localStorage.getItem("impactlens_activities");
        if (stored) localLogs = JSON.parse(stored);
      } catch (err) {
        console.error("Error reading localStorage:", err);
      }

      parsedRows.forEach(row => {
        const unit = UNIT_MAP[row.activity];
        localLogs.push({
          id: `act-local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          date: row.date,
          activity: row.activity,
          quantity: row.quantity,
          unit: unit,
          loggedBy: row.user,
          team: "Lumen"
        });
      });

      try {
        localStorage.setItem("impactlens_activities", JSON.stringify(localLogs));
      } catch (err) {
        console.error("Error writing to localStorage:", err);
        return;
      }

      // Show success toast
      showToast(`Successfully imported ${parsedRows.length} activities!`);

      // Disable import button
      importBtn.disabled = true;

      // Redirect after brief delay
      setTimeout(() => {
        location.href = "dashboard.html";
      }, 1800);
    });
  }

  // ---- Handle File ----
  function handleFile(file) {
    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      renderErrors([{ row: 0, message: "Invalid file type. Please upload a .csv file." }]);
      return;
    }

    // Show file name
    if (fileNameDisplay) {
      fileNameDisplay.innerHTML = `<i class="fa-solid fa-file-csv"></i> ${file.name}`;
    }
    uploadZone.classList.add("has-file");

    // Read the file
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const result = parseAndValidateCSV(content);

      if (result.errors.length > 0) {
        parsedRows = [];
        importBtn.disabled = true;
        renderErrors(result.errors);
      } else {
        parsedRows = result.rows;
        importBtn.disabled = false;
        renderPreview(result.rows);
      }
    };
    reader.onerror = () => {
      renderErrors([{ row: 0, message: "Failed to read the file. Please try again." }]);
    };
    reader.readAsText(file);
  }

  // ---- CSV Parsing ----
  function parseCSVLine(line) {
    const fields = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
    }

    fields.push(current.trim());
    return fields;
  }

  function parseAndValidateCSV(content) {
    const errors = [];
    const rows = [];

    // Split into lines (handle different line endings)
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");

    if (lines.length === 0) {
      errors.push({ row: 0, message: "The CSV file is empty." });
      return { rows, errors };
    }

    // Validate header row
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    const headersMatch = EXPECTED_HEADERS.every((expected, i) => headers[i] === expected);
    if (!headersMatch || headers.length < EXPECTED_HEADERS.length) {
      errors.push({
        row: 1,
        message: `Invalid header row. Expected: "Date, Activity, Quantity, Logged By" — Got: "${parseCSVLine(lines[0]).join(", ")}"`
      });
      return { rows, errors };
    }

    // No data rows
    if (lines.length < 2) {
      errors.push({ row: 0, message: "No data rows found in the CSV file." });
      return { rows, errors };
    }

    // Validate each data row
    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1; // 1-indexed, header is row 1
      const fields = parseCSVLine(lines[i]);

      if (fields.length < 4) {
        errors.push({ row: rowNum, message: `Expected 4 columns, found ${fields.length}.` });
        continue;
      }

      const [dateStr, activityStr, quantityStr, userStr] = fields;

      // Validate date (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        errors.push({ row: rowNum, message: `Invalid date format "${dateStr}". Expected YYYY-MM-DD.` });
      } else {
        // Also check it's a real date
        const dateParts = dateStr.split("-");
        const testDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        if (
          testDate.getFullYear() !== parseInt(dateParts[0]) ||
          testDate.getMonth() !== parseInt(dateParts[1]) - 1 ||
          testDate.getDate() !== parseInt(dateParts[2])
        ) {
          errors.push({ row: rowNum, message: `"${dateStr}" is not a valid calendar date.` });
        }
      }

      // Validate activity
      const normalizedActivity = VALID_ACTIVITIES[activityStr.toLowerCase().trim()];
      if (!normalizedActivity) {
        errors.push({
          row: rowNum,
          message: `Unknown activity "${activityStr}". Valid: Distance Biked, Waste Recycled, Electricity Saved, Water Saved, Sustainable Meals.`
        });
      }

      // Validate quantity
      const quantity = parseFloat(quantityStr);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push({ row: rowNum, message: `Invalid quantity "${quantityStr}". Must be a positive number.` });
      }

      // Validate user
      if (!userStr || userStr.trim() === "") {
        errors.push({ row: rowNum, message: `"Logged By" field is empty.` });
      }

      // If no errors for this row, add to valid rows
      const rowErrors = errors.filter(e => e.row === rowNum);
      if (rowErrors.length === 0 && normalizedActivity) {
        rows.push({
          date: dateStr,
          activity: normalizedActivity,
          quantity: quantity,
          user: userStr.trim()
        });
      }
    }

    return { rows, errors };
  }

  // ---- Render Preview Table ----
  function renderPreview(rows) {
    let totalCO2 = 0;
    rows.forEach(r => {
      const rate = RATES[r.activity] ? RATES[r.activity].rate : 0;
      totalCO2 += r.quantity * rate;
    });

    let html = "";

    // Summary bar
    html += `
      <div class="import-summary">
        <div class="import-summary-item">
          <span class="import-summary-label">Total Rows</span>
          <span class="import-summary-value">${rows.length}</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-label">Total CO₂ Offset</span>
          <span class="import-summary-value accent">${totalCO2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-label">Status</span>
          <span class="import-summary-value" style="color: var(--accent-primary); font-size: 0.95rem;"><i class="fa-solid fa-circle-check"></i> Ready to import</span>
        </div>
      </div>
    `;

    // Table
    html += `
      <div class="csv-table-wrapper">
        <table class="csv-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Activity</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Logged By</th>
              <th>CO₂ Offset</th>
            </tr>
          </thead>
          <tbody>
    `;

    rows.forEach((r, i) => {
      const rate = RATES[r.activity] ? RATES[r.activity].rate : 0;
      const unit = UNIT_MAP[r.activity] || "—";
      const co2 = (r.quantity * rate).toFixed(2);
      html += `
        <tr>
          <td class="row-num">${i + 1}</td>
          <td>${r.date}</td>
          <td>${r.activity}</td>
          <td>${r.quantity}</td>
          <td>${unit}</td>
          <td>${r.user}</td>
          <td class="co2-cell">${co2} kg</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    csvPreview.innerHTML = html;
  }

  // ---- Render Errors ----
  function renderErrors(errors) {
    let html = `
      <div class="error-list-header">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>${errors.length} validation error${errors.length !== 1 ? "s" : ""} found</span>
      </div>
      <ul class="error-list">
    `;

    errors.forEach(err => {
      const badge = err.row > 0 ? `<span class="error-row-badge">Row ${err.row}</span>` : `<span class="error-row-badge">File</span>`;
      html += `
        <li class="error-item">
          ${badge}
          <span>${err.message}</span>
        </li>
      `;
    });

    html += "</ul>";
    csvPreview.innerHTML = html;
  }

  // ---- Toast Notification ----
  function showToast(message) {
    // Remove existing toast if any
    const existing = document.querySelector(".csv-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "csv-toast";
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    // Auto-remove after delay
    setTimeout(() => {
      toast.style.animation = "toastSlideOut 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards";
      setTimeout(() => toast.remove(), 400);
    }, 1500);
  }

})();
