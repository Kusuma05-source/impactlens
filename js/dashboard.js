/**
 * Dashboard Logic for ImpactLens.
 * Interfaces with utils.js variables and methods.
 */

// List of actionable green tips
const GREEN_TIPS = [
  "Commuting via bicycle (Distance Biked) offsets 210g CO2 per km. Swap just 2 car trips a week to boost Lumen's score!",
  "Recycling paper and cardboard saves 0.75kg CO2 per kg. Make sure to compress packages to save landfill space!",
  "Turning off unused computers and monitors can save up to 150 kWh/year—about 67 kg of carbon emissions!",
  "Reducing shower time by 2 minutes saves 15L of water and the energy needed to heat it, lowering your overall footprint.",
  "Planting native trees helps capture carbon, provides habitat for local wildlife, and improves soil moisture absorption.",
  "Using energy-saving LED bulbs instead of incandescent ones reduces energy usage by up to 80% and lasts 25x longer!"
];

let trendChartInstance = null;
let shareChartInstance = null;
let showAllActivities = false;
let cachedActivities = [];
let cachedConversionRates = {};

document.addEventListener("DOMContentLoaded", () => {
  setSystemDate();
  loadDashboardData();
  
  const toggleBtn = document.getElementById("btn-toggle-activities");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      showAllActivities = !showAllActivities;
      renderActivityTable(cachedActivities, cachedConversionRates);
    });
  }
});

// Update the system date dynamically
function setSystemDate() {
  const dateElement = document.getElementById("current-date");
  if (dateElement) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    dateElement.textContent = today.toLocaleDateString('en-US', options);
  }
}



// Main logic to fetch data and render dashboard components
async function loadDashboardData() {
  // Read baseline from global FALLBACK_DATA defined in utils.js
  let data = { ...FALLBACK_DATA };
  
  try {
    const response = await fetch("../data/sample-data.json");
    if (response.ok) {
      data = await response.json();
      console.log("Successfully fetched metrics database.");
    } else {
      console.warn("Could not fetch sample-data.json, using compiled dataset fallback.");
    }
  } catch (error) {
    console.warn("Fetch failed (most likely CORS/file protocol), using compiled dataset fallback.", error);
  }

  // Safe checks for data structure
  data.activities = data.activities || [];
  data.conversionRates = data.conversionRates || {};

  // Integrate local storage activities
  try {
    const storedLocal = localStorage.getItem("impactlens_activities");
    if (storedLocal) {
      const localActivities = JSON.parse(storedLocal);
      if (Array.isArray(localActivities)) {
        data.activities = [...data.activities, ...localActivities];
        console.log(`Merged ${localActivities.length} local actions from localStorage.`);
      }
    }
  } catch (err) {
    console.warn("Failed to load local activities from localStorage:", err);
  }

  // 1. Process calculations using global function in utils.js
  const summary = calculateSustainabilityMetrics(data);
  
  // 2. Render KPI cards
  renderKPICards(summary);
  
  // 3. Render recent activities table
  cachedActivities = data.activities;
  cachedConversionRates = data.conversionRates;
  renderActivityTable(cachedActivities, cachedConversionRates);
  
  // 4. Render charts
  renderCharts(summary, data.activities, data.conversionRates);

  // 5. Render streak widget
  renderStreakWidget(data.activities);

  // 6. Render activity calendar (last 7 days)
  renderActivityCalendar(data.activities);

  // 7. Render today's impact summary
  renderTodayImpact(data.activities, data.conversionRates);
}


// Render the metric highlights and update goal meters
function renderKPICards(summary) {
  // Update numbers safely
  document.getElementById("val-co2").textContent = (summary.totalCO2 || 0).toFixed(1);
  document.getElementById("val-waste").textContent = (summary.totals["Waste Recycled"] || 0).toFixed(0);
  document.getElementById("val-energy").textContent = (summary.totals["Electricity Saved"] || 0).toFixed(0);
  document.getElementById("val-biked").textContent = (summary.totals["Distance Biked"] || 0).toFixed(0);

  // Calculate and update progress bars using global GOALS defined in utils.js
  const pctCO2 = Math.min(100, Math.round(((summary.totalCO2 || 0) / GOALS.co2) * 100));
  const pctWaste = Math.min(100, Math.round(((summary.totals["Waste Recycled"] || 0) / GOALS.waste) * 100));
  const pctEnergy = Math.min(100, Math.round(((summary.totals["Electricity Saved"] || 0) / GOALS.energy) * 100));
  const pctBiked = Math.min(100, Math.round(((summary.totals["Distance Biked"] || 0) / GOALS.biked) * 100));

  updateProgressBar("kpi-co2", pctCO2);
  updateProgressBar("kpi-waste", pctWaste);
  updateProgressBar("kpi-energy", pctEnergy);
  updateProgressBar("kpi-biked", pctBiked);
}

function updateProgressBar(cardId, percentage) {
  const card = document.getElementById(cardId);
  if (card) {
    const fill = card.querySelector(".progress-bar-fill");
    const label = card.querySelector(".progress-label");
    if (fill) fill.style.width = `${percentage}%`;
    if (label) label.textContent = `Goal Progress: ${percentage}%`;
  }
}

// Render dynamic activity list
function renderActivityTable(activities, conversionRates) {
  const tableBody = document.getElementById("activity-log-body");
  if (!tableBody) return;
  
  tableBody.innerHTML = "";
  
  const actionsContainer = document.getElementById("table-actions-container");
  const toggleBtn = document.getElementById("btn-toggle-activities");
  
  if (activities.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No activities logged yet. Get started by clicking "Log Activity"!</td></tr>`;
    if (actionsContainer) actionsContainer.style.display = "none";
    return;
  }
  
  // Sort activities by date descending
  const sorted = [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Show toggle button if activities exceed 5
  if (sorted.length > 5) {
    if (actionsContainer) actionsContainer.style.display = "flex";
    if (toggleBtn) {
      const btnText = toggleBtn.querySelector("span");
      const btnIcon = toggleBtn.querySelector("i");
      if (showAllActivities) {
        if (btnText) btnText.textContent = "Show Less";
        if (btnIcon) btnIcon.className = "fa-solid fa-chevron-up";
      } else {
        if (btnText) btnText.textContent = "Show More";
        if (btnIcon) btnIcon.className = "fa-solid fa-chevron-down";
      }
    }
  } else {
    if (actionsContainer) actionsContainer.style.display = "none";
  }
  
  // Show either top 5 or all activities
  const visibleActivities = showAllActivities ? sorted : sorted.slice(0, 5);
  
  visibleActivities.forEach(act => {
    if (!act) return;
    const rateInfo = conversionRates[act.activity];
    const categoryClass = rateInfo ? (rateInfo.category || "waste").toLowerCase() : "waste";
    const qty = parseFloat(act.quantity) || 0;
    const rate = rateInfo ? (parseFloat(rateInfo.rate) || 0) : 0;
    const co2Val = (qty * rate).toFixed(2);
    
    // Format date beautifully (e.g. 2 Jan)
    const dateObj = new Date(act.date);
    const day = dateObj.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedDate = `${day} ${monthNames[dateObj.getMonth()]}`;

    // Category icon mapper
    let iconHTML = '<i class="fa-solid fa-leaf"></i>';
    if (act.activity === "Waste Recycled") iconHTML = '<i class="fa-solid fa-recycle"></i>';
    if (act.activity === "Sustainable Meals") iconHTML = '<i class="fa-solid fa-utensils"></i>';
    if (act.activity === "Distance Biked") iconHTML = '<i class="fa-solid fa-bicycle"></i>';
    if (act.activity === "Electricity Saved") iconHTML = '<i class="fa-solid fa-bolt"></i>';
    if (act.activity === "Water Saved") iconHTML = '<i class="fa-solid fa-droplet"></i>';

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>
        <span class="badge-category ${categoryClass}">
          ${iconHTML} ${act.activity}
        </span>
      </td>
      <td style="font-weight: 500;">${qty} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">${act.unit || ''}</span></td>
      <td style="font-weight: 600; color: var(--accent-primary);">${co2Val} kg</td>
      <td style="color: var(--text-secondary); font-size: 0.85rem;">${act.loggedBy || 'Unknown'}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// Generate the beautiful Chart.js visualizations
function renderCharts(summary, activities, conversionRates) {
  // Global Chart config defaults for dark-mode premium look
  Chart.defaults.color = '#9ca3af';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 24, 39, 0.95)';
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Outfit', sans-serif", size: 13, weight: 'bold' };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'Inter', sans-serif", size: 12 };
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.08)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  
  // -------------------------------------------------------------
  // Chart 1: Line Chart - Carbon Offset Accumulation Over Time
  // -------------------------------------------------------------
  const ctxTrend = document.getElementById("co2TrendChart");
  if (ctxTrend) {
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }
    
    // Sort activities by date ascending to build chronological line
    const chronoActivities = [...activities].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group and aggregate offsets by date to prevent duplicate labels on X-axis
    const dailyOffsets = {};
    chronoActivities.forEach(act => {
      if (!act) return;
      const rateInfo = conversionRates[act.activity];
      const co2 = rateInfo ? (parseFloat(act.quantity) || 0) * (parseFloat(rateInfo.rate) || 0) : 0;
      
      const dateObj = new Date(act.date);
      const day = dateObj.getDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${day} ${monthNames[dateObj.getMonth()]}`;
      
      if (dailyOffsets[formattedDate] === undefined) {
        dailyOffsets[formattedDate] = 0;
      }
      dailyOffsets[formattedDate] += co2;
    });
    
    const labels = Object.keys(dailyOffsets);
    const cumulativeData = [];
    let sum = 0;
    
    labels.forEach(date => {
      sum += dailyOffsets[date];
      cumulativeData.push(sum.toFixed(1));
    });

    // Create gradient fill
    const canvas = ctxTrend;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    trendChartInstance = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cumulative CO2e Offset (kg)',
          data: cumulativeData,
          borderColor: '#10B981',
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10B981',
          pointBorderColor: 'rgba(9, 13, 22, 1)',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#06B6D4',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              padding: 10
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)',
              drawBorder: false
            },
            ticks: {
              padding: 10,
              callback: function(value) {
                return value + ' kg';
              }
            }
          }
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Chart 2: Doughnut Chart - Category Impact Breakdown
  // -------------------------------------------------------------
  const ctxShare = document.getElementById("categoryShareChart");
  if (ctxShare) {
    if (shareChartInstance) {
      shareChartInstance.destroy();
    }

    const categories = Object.keys(summary.categoryOffsets).filter(cat => summary.categoryOffsets[cat] > 0);
    const offsets = categories.map(cat => summary.categoryOffsets[cat].toFixed(1));
    
    // Map categories to colors
    const colorMap = {
      "Waste": "#10B981",
      "Food": "#F43F5E",
      "Transport": "#3B82F6",
      "Energy": "#F59E0B",
      "Water": "#06B6D4"
    };
    const bgColors = categories.map(cat => colorMap[cat] || '#6b7280');

    shareChartInstance = new Chart(ctxShare, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: offsets,
          backgroundColor: bgColors,
          borderColor: 'rgba(17, 24, 39, 1)',
          borderWidth: 3,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 15,
              font: {
                size: 11
              }
            }
          }
        },
        cutout: '72%'
      }
    });
  }
}

// ============================================
// STREAK WIDGET
// ============================================

function getDateString(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStreakData() {
  try {
    const stored = localStorage.getItem("impactlens_streak");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Could not read streak data:", e);
  }
  return { currentStreak: 0, longestStreak: 0, lastLogDate: null };
}

function getMotivationalMessage(streak) {
  if (streak === 0) return "Log an activity to start your streak!";
  if (streak === 1) return "Great start! Come back tomorrow to keep it going!";
  if (streak <= 3) return "You're building momentum — keep it up! 💪";
  if (streak <= 7) return "A full week of impact is within reach! 🌱";
  if (streak <= 14) return "Incredible consistency — you're a sustainability hero! 🌍";
  if (streak <= 30) return "Unstoppable! Your dedication is making a real difference! 🏆";
  return "Legendary streak! You're an environmental champion! 🔥🌟";
}

function renderStreakWidget(activities) {
  const streakData = getStreakData();
  const actualCurrent = streakData.currentStreak || 0;
  
  // Enforce 3-day rule for display
  const displayCurrent = actualCurrent >= 3 ? actualCurrent : 0;
  
  // Also only show longest if it's >= 3
  const longestStreak = streakData.longestStreak || 0;
  const displayLongest = longestStreak >= 3 ? longestStreak : 0;

  // Update DOM
  const streakNumber = document.getElementById("streak-current");
  const streakLongest = document.getElementById("streak-longest");
  const streakMessage = document.getElementById("streak-message");
  const streakFlame = document.getElementById("streak-flame");

  if (streakNumber) streakNumber.textContent = displayCurrent;
  if (streakLongest) streakLongest.textContent = displayLongest;
  
  if (streakMessage) {
    if (actualCurrent === 0) streakMessage.textContent = "Log an activity to start your streak!";
    else if (actualCurrent === 1) streakMessage.textContent = "Great start! Log for 2 more days to ignite your streak! 🔥";
    else if (actualCurrent === 2) streakMessage.textContent = "Almost there! 1 more day to unlock your streak! ⏳";
    else streakMessage.textContent = getMotivationalMessage(displayCurrent);
  }

  // Apply flame intensity classes
  if (streakFlame) {
    streakFlame.classList.remove("active", "blazing");
    if (displayCurrent >= 7) {
      streakFlame.classList.add("blazing");
    } else if (displayCurrent >= 3) {
      streakFlame.classList.add("active");
    }
  }

  // Update label pluralization
  const streakLabel = document.querySelector(".streak-label");
  if (streakLabel) {
    streakLabel.textContent = "day streak";
  }
}

// ============================================
// ACTIVITY CALENDAR (Last 7 Days)
// ============================================

function renderActivityCalendar(activities) {
  const container = document.getElementById("calendar-dots");
  if (!container) return;

  container.innerHTML = "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Build a set of dates that have activities
  const activeDates = new Set();
  const dateActivityCounts = {};
  activities.forEach(act => {
    if (!act || !act.date) return;
    const dateStr = getDateString(act.date);
    activeDates.add(dateStr);
    dateActivityCounts[dateStr] = (dateActivityCounts[dateStr] || 0) + 1;
  });

  // Generate last 7 days (from 6 days ago to today)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = getDateString(date);
    const isToday = i === 0;
    const isActive = activeDates.has(dateStr);
    const count = dateActivityCounts[dateStr] || 0;

    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";

    const dotClasses = ["calendar-dot"];
    if (isActive) dotClasses.push("active");
    if (isToday) dotClasses.push("today");

    dayEl.innerHTML = `
      <span class="calendar-day-name">${dayNames[date.getDay()]}</span>
      <div class="${dotClasses.join(" ")}"></div>
      <span class="calendar-day-date">${date.getDate()} ${monthNames[date.getMonth()]}</span>
      <span class="calendar-day-count ${count > 0 ? 'has-activity' : ''}">${count > 0 ? count + ' log' + (count > 1 ? 's' : '') : '—'}</span>
    `;

    container.appendChild(dayEl);
  }
}

// ============================================
// TODAY'S IMPACT
// ============================================

function renderTodayImpact(activities, conversionRates) {
  const todayStr = getDateString(new Date());

  let todayCount = 0;
  let todayCO2 = 0;

  activities.forEach(act => {
    if (!act || !act.date) return;
    if (getDateString(act.date) === todayStr) {
      todayCount++;
      const rateInfo = conversionRates[act.activity];
      if (rateInfo) {
        todayCO2 += (parseFloat(act.quantity) || 0) * (parseFloat(rateInfo.rate) || 0);
      }
    }
  });

  const todayActivitiesEl = document.getElementById("today-activities");
  const todayCO2El = document.getElementById("today-co2");

  if (todayActivitiesEl) todayActivitiesEl.textContent = todayCount;
  if (todayCO2El) todayCO2El.textContent = todayCO2.toFixed(1);
}

// ============================================
// DAILY PROGRESS BAR CHART (Last 7 Days)
// ============================================


