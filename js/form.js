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
        
        // Calculate CO2 and Coins
        const co2Amount = qty * rateInfo.rate;
        let currentStreak = 0;
        try {
          const storedStreak = localStorage.getItem('impactlens_streak');
          if (storedStreak) currentStreak = JSON.parse(storedStreak).currentStreak || 0;
        } catch(e) {}
        
        // Assume calculateEarnedCoins is available globally from utils.js
        const coinsEarned = typeof calculateEarnedCoins === 'function' ? calculateEarnedCoins(co2Amount, currentStreak) : (co2Amount * 100);
        
        const newActivity = {
          coinsEarned: coinsEarned,
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
  
  // Update totalCoins
  if (activity.coinsEarned) {
    let totalCoins = 0;
    try {
      totalCoins = parseFloat(localStorage.getItem('impactlens_totalCoins')) || 0;
    } catch(e) {}
    totalCoins += activity.coinsEarned;
    localStorage.setItem('impactlens_totalCoins', totalCoins.toString());
  }
  
  try {
    localStorage.setItem("impactlens_activities", JSON.stringify(localLogs));
    console.log("Logged activity successfully stored locally:", activity);
  } catch (err) {
    console.error("Error writing to localStorage:", err);
  }
}

