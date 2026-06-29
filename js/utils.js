/**
 * central utility module for ImpactLens.
 * Contains central sample database fallbacks, goals, and metric calculators.
 */

const FALLBACK_DATA = {
  "conversionRates": {
    "Waste Recycled": { "rate": 0.75, "unit": "kg", "co2Unit": "kg CO2e", "category": "Waste", "color": "#10B981" },
    "Trees Planted": { "rate": 22.0, "unit": "count", "co2Unit": "kg CO2e", "category": "Forestry", "color": "#059669" },
    "Distance Biked": { "rate": 0.21, "unit": "km", "co2Unit": "kg CO2e", "category": "Transport", "color": "#3B82F6" },
    "Electricity Saved": { "rate": 0.45, "unit": "kWh", "co2Unit": "kg CO2e", "category": "Energy", "color": "#F59E0B" },
    "Water Saved": { "rate": 0.002, "unit": "L", "co2Unit": "kg CO2e", "category": "Water", "color": "#06B6D4" }
  },
  "activities": [
    { "id": "act-1", "date": "2026-01-02", "activity": "Waste Recycled", "quantity": 120, "unit": "kg", "loggedBy": "Elena Vance", "team": "Lumen" },
    { "id": "act-2", "date": "2026-01-04", "activity": "Trees Planted", "quantity": 15, "unit": "count", "loggedBy": "Marcus Fenix", "team": "Lumen" },
    { "id": "act-3", "date": "2026-01-06", "activity": "Distance Biked", "quantity": 80, "unit": "km", "loggedBy": "Kusuma", "team": "Lumen" },
    { "id": "act-4", "date": "2026-01-08", "activity": "Electricity Saved", "quantity": 230, "unit": "kWh", "loggedBy": "Sarah Connor", "team": "Lumen" },
    { "id": "act-5", "date": "2026-01-10", "activity": "Water Saved", "quantity": 950, "unit": "L", "loggedBy": "Lumen Leader", "team": "Lumen" }
  ],
  "leaderboard": [
    { "team": "Lumen", "members": 5, "totalCO2Offset": 542.2 },
    { "team": "EcoWarriors", "members": 6, "totalCO2Offset": 420.5 },
    { "team": "GreenTech", "members": 4, "totalCO2Offset": 380.0 },
    { "team": "TerraForce", "members": 5, "totalCO2Offset": 290.4 }
  ]
};

const GOALS = {
  co2: 1000,     // kg CO2e
  waste: 200,    // kg
  energy: 500,   // kWh
  biked: 100     // km
};

// Calculate carbon offsets safely with type checks and dynamic fallbacks
function calculateSustainabilityMetrics(data) {
  const activities = data.activities || [];
  const conversionRates = data.conversionRates || {};
  
  const totals = {
    "Waste Recycled": 0,
    "Trees Planted": 0,
    "Distance Biked": 0,
    "Electricity Saved": 0,
    "Water Saved": 0
  };
  
  const categoryOffsets = {};
  let totalCO2 = 0;

  activities.forEach(act => {
    if (!act || !act.activity) return;

    const name = act.activity;
    const qty = parseFloat(act.quantity) || 0;
    const rateInfo = conversionRates[name];
    
    // Add dynamic keys if new categories/activities are entered
    if (totals[name] === undefined) {
      totals[name] = 0;
    }
    totals[name] += qty;

    if (rateInfo) {
      const co2Offset = qty * (parseFloat(rateInfo.rate) || 0);
      totalCO2 += co2Offset;
      
      const cat = rateInfo.category || "Other";
      if (categoryOffsets[cat] === undefined) {
        categoryOffsets[cat] = 0;
      }
      categoryOffsets[cat] += co2Offset;
    }
  });

  // Ensure default categories are present to prevent crashes on frontend
  const defaultCategories = ["Waste", "Forestry", "Transport", "Energy", "Water"];
  defaultCategories.forEach(cat => {
    if (categoryOffsets[cat] === undefined) {
      categoryOffsets[cat] = 0;
    }
  });

  return {
    totals,
    categoryOffsets,
    totalCO2
  };
}
