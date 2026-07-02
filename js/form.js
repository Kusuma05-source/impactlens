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

// Wire up checkbox and input listeners
function setupFormListeners() {
  const checkboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
  const dynamicContainer = document.getElementById("dynamic-quantities");
  const previewCO2 = document.getElementById("preview-co2");
  const submitBtn = document.getElementById("btn-submit");
  const form = document.getElementById("activity-form");

  if (!dynamicContainer || !previewCO2 || !submitBtn || !form) return;

  function calculateTotalCO2() {
    let total = 0;
    let hasValidQuantity = false;
    const inputs = dynamicContainer.querySelectorAll('input[type="number"]');
    
    inputs.forEach(input => {
      const cat = input.dataset.category;
      const qty = parseFloat(input.value);
      if (!isNaN(qty) && qty > 0) {
        hasValidQuantity = true;
        if (RATES[cat]) {
          total += qty * RATES[cat].rate;
        }
      }
    });
    
    previewCO2.textContent = total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    // Enable submit if at least one valid quantity exists
    submitBtn.disabled = !hasValidQuantity;
  }

  checkboxes.forEach(cb => {
    cb.addEventListener("change", (e) => {
      const category = e.target.value;
      const rateInfo = RATES[category];
      const parentLabel = e.target.closest('.category-checkbox');
      
      if (e.target.checked) {
        parentLabel.classList.add('selected');
        
        // Inject input for this category
        const row = document.createElement('div');
        row.className = 'dynamic-qty-row';
        row.id = `qty-row-${category.replace(/\s+/g, '-')}`;
        row.innerHTML = `
          <label>${category} Quantity</label>
          <div class="input-with-unit">
            <input type="number" data-category="${category}" min="0.1" step="any" placeholder="Enter amount" required>
            <span class="unit-badge">${rateInfo.unit}</span>
          </div>
        `;
        dynamicContainer.appendChild(row);
        
        // Listen to this specific input
        const inputField = row.querySelector('input');
        inputField.addEventListener("input", calculateTotalCO2);
        inputField.focus();
        
      } else {
        parentLabel.classList.remove('selected');
        const row = document.getElementById(`qty-row-${category.replace(/\s+/g, '-')}`);
        if (row) {
          row.remove();
        }
      }
      
      calculateTotalCO2();
    });
  });

  // Handle submit button
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const date = document.getElementById("act-date").value;
    const user = document.getElementById("act-user").value.trim();
    const inputs = dynamicContainer.querySelectorAll('input[type="number"]');
    
    if (!date || !user || inputs.length === 0) {
      alert("Please enter your name and select at least one category to log.");
      return;
    }
    
    let hasValidQuantity = false;
    
    inputs.forEach(input => {
      const category = input.dataset.category;
      const qty = parseFloat(input.value);
      
      if (!isNaN(qty) && qty > 0) {
        hasValidQuantity = true;
        const rateInfo = RATES[category];
        const newActivity = {
          // Generate a unique ID for each split activity
          id: `act-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          date: date,
          activity: category,
          quantity: qty,
          unit: rateInfo.unit,
          loggedBy: user,
          team: "Lumen"
        };
        // Save each individually
        saveActivityLocal(newActivity);
      }
    });

    if (!hasValidQuantity) {
      alert("Please enter a valid quantity for your selected categories.");
      return;
    }
    
    // Update streak based on activity date
    updateStreak(date);
    
    // Redirect back to dashboard
    location.href = "dashboard.html";
  });
}

// ============================================
// STREAK UPDATE LOGIC
// ============================================

function updateStreak(activityDateStr) {
  // Read existing streak data
  let streakData = { currentStreak: 0, longestStreak: 0, lastLogDate: null };
  try {
    const stored = localStorage.getItem("impactlens_streak");
    if (stored) {
      streakData = JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Could not read streak data:", e);
  }

  // Normalize today's date to YYYY-MM-DD
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Use the activity date for streak calculation
  const actDate = new Date(activityDateStr);
  actDate.setHours(0, 0, 0, 0);
  const actDateStr = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}`;

  const lastLogDate = streakData.lastLogDate;

  if (!lastLogDate) {
    // First ever log
    streakData.currentStreak = 1;
    streakData.lastLogDate = actDateStr;
  } else if (actDateStr === lastLogDate) {
    // Same day — streak stays the same, ensure at least 1
    if (streakData.currentStreak === 0) {
      streakData.currentStreak = 1;
    }
  } else {
    // Calculate day difference
    const lastDate = new Date(lastLogDate);
    lastDate.setHours(0, 0, 0, 0);
    const diffMs = actDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day — streak continues
      streakData.currentStreak += 1;
      streakData.lastLogDate = actDateStr;
    } else if (diffDays > 1) {
      // Gap — streak resets
      streakData.currentStreak = 1;
      streakData.lastLogDate = actDateStr;
    } else if (diffDays < 0) {
      // Logging a past date — don't break streak, but don't extend it either
      // Only update lastLogDate if it's more recent
    }
  }

  // Update longest streak
  if (streakData.currentStreak > streakData.longestStreak) {
    streakData.longestStreak = streakData.currentStreak;
  }

  // Save back to localStorage
  try {
    localStorage.setItem("impactlens_streak", JSON.stringify(streakData));
    console.log("Streak updated:", streakData);
  } catch (e) {
    console.error("Error saving streak data:", e);
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

  const EXPECTED_HEADERS = ["activity", "quantity", "logged by"];

  // State for parsed data
  let parsedRows = [];
  
  // Set upload date UI
  const uploadDateEl = document.getElementById("bulk-upload-date");
  if (uploadDateEl) {
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    uploadDateEl.textContent = new Date().toLocaleDateString('en-US', options);
  }

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
        "Activity,Quantity,Logged By",
        "Distance Biked,15,Kusuma",
        "Waste Recycled,3.5,Elena Vance",
        "Electricity Saved,12,Marcus Fenix",
        "Water Saved,200,Sarah Connor",
        "Sustainable Meals,4,Lumen Leader"
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

      // Update streak for each imported row (use the latest date for streak)
      // Sort by date and update streak for the most recent date
      const sortedDates = parsedRows.map(r => r.date).sort();
      sortedDates.forEach(dateStr => {
        updateStreak(dateStr);
      });

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
        message: `Invalid header row. Expected: "Activity, Quantity, Logged By" — Got: "${parseCSVLine(lines[0]).join(", ")}"`
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

      if (fields.length < 3) {
        errors.push({ row: rowNum, message: `Expected 3 columns, found ${fields.length}.` });
        continue;
      }

      const [activityStr, quantityStr, userStr] = fields;

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
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        rows.push({
          date: todayStr,
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
