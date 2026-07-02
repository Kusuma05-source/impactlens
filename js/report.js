/**
 * Report Logic for ImpactLens.
 * Interfaces with utils.js variables and methods.
 */

// Core dataset variables saved globally for theme updates & AI compilation
let reportData = null;
let reportActivities = [];
let reportConversionRates = {};
let docTrendChart = null;
let docShareChart = null;

document.addEventListener("DOMContentLoaded", () => {
  setReportDate();
  loadReportData();
  setupReportControls();
});

// Display compilation date
function setReportDate() {
  const dateSpan = document.getElementById("compile-date");
  if (dateSpan) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    dateSpan.textContent = new Date().toLocaleDateString('en-US', options);
  }
}

// Bind template selectors and buttons
function setupReportControls() {
  const templateSelect = document.getElementById("report-format");
  const reportDoc = document.getElementById("report-document");
  const btnRecompile = document.getElementById("btn-recompile");
  const btnAI = document.getElementById("btn-generate-ai");

  if (templateSelect && reportDoc) {
    templateSelect.addEventListener("change", () => {
      const isLight = templateSelect.value === "clean-light";
      if (isLight) {
        reportDoc.classList.add("light-theme");
      } else {
        reportDoc.classList.remove("light-theme");
      }
      // Re-render charts using the dynamically loaded data
      updateChartThemes(isLight);
    });
  }

  if (btnRecompile) {
    btnRecompile.addEventListener("click", () => {
      btnRecompile.disabled = true;
      btnRecompile.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Recompiling...`;
      
      // Clear AI summary output box for fresh compile
      const output = document.getElementById("ai-summary-output");
      if (output) {
        output.innerHTML = `<p class="placeholder-text">Click "Generate AI Summary" to feed logs into the AI engine and write the executive statement.</p>`;
        output.className = "ai-output-box empty";
      }
      
      setTimeout(async () => {
        await loadReportData();
        btnRecompile.disabled = false;
        btnRecompile.innerHTML = `<i class="fa-solid fa-sync"></i> Recompile Metrics`;
      }, 600);
    });
  }

  if (btnAI) {
    btnAI.addEventListener("click", () => {
      if (reportData) {
        const output = document.getElementById("ai-summary-output");
        const prompt = document.getElementById("prompt-text");
        
        toggleControlsLock(true);
        triggerAISummary(reportData, output, prompt, btnAI).finally(() => {
          toggleControlsLock(false);
        });
      }
    });
  }
}

// Lock/unlock layout controls to prevent compilation conflicts
function toggleControlsLock(isLocked) {
  const templateSelect = document.getElementById("report-format");
  const btnRecompile = document.getElementById("btn-recompile");
  
  if (templateSelect) templateSelect.disabled = isLocked;
  if (btnRecompile) btnRecompile.disabled = isLocked;
}

// Fetch activities and compile report statistics
async function loadReportData() {
  // Use baseline from global FALLBACK_DATA defined in utils.js
  let data = { ...FALLBACK_DATA };

  try {
    const response = await fetch("../data/sample-data.json");
    if (response.ok) {
      data = await response.json();
    }
  } catch (error) {
    console.warn("Report fetch failed, utilizing fallback data.", error);
  }

  // Safe checks for data structure
  data.activities = data.activities || [];
  data.conversionRates = data.conversionRates || {};

  // Merge localStorage activities
  try {
    const storedLocal = localStorage.getItem("impactlens_activities");
    if (storedLocal) {
      const localActivities = JSON.parse(storedLocal);
      if (Array.isArray(localActivities)) {
        data.activities = [...data.activities, ...localActivities];
      }
    }
  } catch (err) {
    console.warn("localStorage loading failed in reporter module.", err);
  }

  // Filter by selected period
  const periodSelect = document.getElementById("report-period");
  if (periodSelect && data.activities) {
    const period = periodSelect.value;
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    let startDate = new Date(0); // All time
    let endDate = new Date(now);
    
    if (period === "this-week") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0,0,0,0);
    } else if (period === "this-month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "last-month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    
    data.activities = data.activities.filter(act => {
      if (!act || !act.date) return false;
      const actDate = new Date(act.date);
      return actDate >= startDate && actDate <= endDate;
    });
  }

  // Save to global variables for templates and theme updates
  reportActivities = data.activities;
  reportConversionRates = data.conversionRates;

  // Run Calculations
  const summary = calculateSustainabilityMetrics(data);
  reportData = summary; // Save globally for AI module

  // Update Sheet Fields safely
  document.getElementById("doc-co2").textContent = (summary.totalCO2 || 0).toFixed(1);
  document.getElementById("doc-waste").textContent = (summary.totals["Waste Recycled"] || 0).toFixed(0);
  document.getElementById("doc-energy").textContent = (summary.totals["Electricity Saved"] || 0).toFixed(0);
  document.getElementById("doc-biked").textContent = (summary.totals["Distance Biked"] || 0).toFixed(0);
  document.getElementById("doc-water").textContent = (summary.totals["Water Saved"] || 0).toFixed(0);
  document.getElementById("doc-food").textContent = (summary.totals["Sustainable Meals"] || 0).toFixed(0);

  // Render Table
  populateReportTable(reportActivities, reportConversionRates);

  // Render Charts
  const templateSelect = document.getElementById("report-format");
  const isLight = templateSelect ? (templateSelect.value === "clean-light") : false;
  renderReportCharts(summary, reportActivities, reportConversionRates, isLight);
}

// Render activity table rows
function populateReportTable(activities, conversionRates) {
  const tableBody = document.getElementById("doc-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  
  if (activities.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No logged activities compiled.</td></tr>`;
    return;
  }

  // Sort activities chronologically for report
  const sorted = [...activities].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(act => {
    if (!act) return;
    const rateInfo = conversionRates[act.activity];
    const qty = parseFloat(act.quantity) || 0;
    const rate = rateInfo ? (parseFloat(rateInfo.rate) || 0) : 0;
    const offsetVal = (qty * rate).toFixed(2);
    const baselineText = rateInfo ? `${rate} CO2e/${rateInfo.unit || ''}` : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${act.date}</td>
      <td><strong>${act.activity}</strong> (by ${act.loggedBy || 'Unknown'})</td>
      <td>${qty} ${act.unit || ''}</td>
      <td style="font-style: italic; color: var(--text-muted);">${baselineText}</td>
      <td style="font-weight: 600; color: #10B981;">${offsetVal} kg</td>
    `;
    tableBody.appendChild(tr);
  });
}

// Generate Chart.js graphics
function renderReportCharts(summary, activities, conversionRates, isLightTheme) {
  const textColor = isLightTheme ? '#374151' : '#9ca3af';
  const gridColor = isLightTheme ? '#e5e7eb' : 'rgba(255, 255, 255, 0.04)';
  
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

  // 1. Line Chart
  const ctxTrend = document.getElementById("docTrendChart");
  if (ctxTrend) {
    if (docTrendChart) docTrendChart.destroy();

    const canvas = ctxTrend;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    docTrendChart = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Carbon Offset (kg)',
          data: cumulativeData,
          borderColor: '#10B981',
          borderWidth: 2,
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#10B981'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 9 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 9 } }
          }
        }
      }
    });
  }

  // 2. Share Chart
  const ctxShare = document.getElementById("docShareChart");
  if (ctxShare) {
    if (docShareChart) docShareChart.destroy();

    const categories = Object.keys(summary.categoryOffsets).filter(cat => summary.categoryOffsets[cat] > 0);
    const offsets = categories.map(cat => summary.categoryOffsets[cat].toFixed(1));
    
    const colorMap = {
      "Waste": "#10B981",
      "Food": "#F43F5E",
      "Transport": "#3B82F6",
      "Energy": "#F59E0B",
      "Water": "#06B6D4"
    };
    const bgColors = categories.map(cat => colorMap[cat] || '#6b7280');

    docShareChart = new Chart(ctxShare, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: offsets,
          backgroundColor: bgColors,
          borderWidth: isLightTheme ? 2 : 1,
          borderColor: isLightTheme ? '#ffffff' : '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              boxWidth: 8,
              font: { size: 9 },
              padding: 10
            }
          }
        }
      }
    });
  }
}

// Trigger chart theme updates dynamically
function updateChartThemes(isLight) {
  if (reportData) {
    renderReportCharts(reportData, reportActivities, reportConversionRates, isLight);
  }
}
