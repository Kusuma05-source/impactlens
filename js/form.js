// Base rates for real-time calculations
const RATES = {
  "Waste Recycled": { rate: 0.75, unit: "kg" },
  "Trees Planted": { rate: 22.0, unit: "count" },
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
