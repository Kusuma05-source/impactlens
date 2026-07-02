document.addEventListener("DOMContentLoaded", () => {
  const quickLogSubmit = document.getElementById("quick-log-submit");
  if (quickLogSubmit) {
    quickLogSubmit.addEventListener("click", handleQuickLogSubmit);
  }
});

async function handleQuickLogSubmit() {
  const inputEl = document.getElementById("quick-log-input");
  const text = inputEl.value.trim();
  if (!text) return;
  
  const submitBtn = document.getElementById("quick-log-submit");
  const originalHtml = submitBtn.innerHTML;
  
  // 1. Loading state
  submitBtn.innerHTML = 'Thinking... <i class="fa-solid fa-spinner fa-spin"></i>';
  submitBtn.disabled = true;
  
  try {
    // 2. Gemini API Call
    const apiKey = "YOUR_API_KEY_HERE";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const systemInstruction = `You are a strict data parser. Parse the user's natural language input about their sustainable activities and return a JSON array of objects. 
Each object MUST have exactly two keys: "activity" (string) and "quantity" (number).
The "activity" MUST be one of the exact strings defined below:
- "Waste Recycled" (quantity in kg)
- "Sustainable Meals" (quantity in meals)
- "Distance Biked" (quantity in km)
- "Electricity Saved" (quantity in kWh)
- "Water Saved" (quantity in L)

Do not include any other text, markdown formatting, or explanation. ONLY return the raw JSON array.
If no valid activities are found, return an empty array [].
Example: [{"activity": "Distance Biked", "quantity": 5}, {"activity": "Waste Recycled", "quantity": 2.5}]`;

    const requestBody = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        parts: [{ text: text }]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error("API request failed");
    }
    
    const data = await response.json();
    let jsonString = data.candidates[0].content.parts[0].text;
    
    // Sometimes Gemini returns markdown even with response_mime_type, so strip it just in case
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const activities = JSON.parse(jsonString);
    
    // 3. Process and Save
    if (activities && activities.length > 0) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      // Update Streak first to ensure accurate coin calculation
      updateStreakLocal(dateStr);
      
      activities.forEach(act => {
        // Validate against known activities from utils.js / dashboard.js global
        const convRates = Object.keys(cachedConversionRates).length > 0 ? cachedConversionRates : (typeof FALLBACK_DATA !== "undefined" ? FALLBACK_DATA.conversionRates : {}); if (!convRates[act.activity]) return; const actUnit = convRates[act.activity].unit;
        const rate = convRates[act.activity].rate || 0;
        const co2Amount = act.quantity * rate;
        
        let currentStreak = 0;
        try {
          const storedStreak = localStorage.getItem('impactlens_streak');
          if (storedStreak) currentStreak = JSON.parse(storedStreak).currentStreak || 0;
        } catch(e) {}
        
        const coinsEarned = typeof calculateEarnedCoins === 'function' ? calculateEarnedCoins(co2Amount, currentStreak) : (co2Amount * 100);
        
        const newActivity = {
          coinsEarned: coinsEarned,
          id: `act-gemini-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          date: dateStr,
          activity: act.activity,
          quantity: act.quantity,
          unit: actUnit,
          loggedBy: "Lumen User", // Default user since there's no auth
          team: "Lumen"
        };
        
        saveActivityLocal(newActivity);
      });
      
      // 4. Update UI
      inputEl.value = "";
      
      // Call global dashboard update function to refresh KPIs, Charts, etc.
      if (typeof loadDashboardData === 'function') {
        loadDashboardData();
      }
      
    } else {
      alert("Could not detect any sustainable activities in your input.");
    }
    
  } catch (err) {
    console.error(err);
    alert("Error processing your request. Please try again.");
  } finally {
    submitBtn.innerHTML = originalHtml;
    submitBtn.disabled = false;
  }
}

// Copy of saveActivityLocal to ensure standalone execution in dashboard context
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

// Copy of updateStreak logic
function updateStreakLocal(activityDateStr) {
  let streakData = { currentStreak: 0, longestStreak: 0, lastLogDate: null };
  try {
    const stored = localStorage.getItem("impactlens_streak");
    if (stored) {
      streakData = JSON.parse(stored);
    }
  } catch (e) {}

  const actDate = new Date(activityDateStr);
  actDate.setHours(0, 0, 0, 0);
  const actDateStr = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}`;

  const lastLogDate = streakData.lastLogDate;

  if (!lastLogDate) {
    streakData.currentStreak = 1;
    streakData.lastLogDate = actDateStr;
  } else if (actDateStr === lastLogDate) {
    if (streakData.currentStreak === 0) streakData.currentStreak = 1;
  } else {
    const lastDate = new Date(lastLogDate);
    lastDate.setHours(0, 0, 0, 0);
    const diffMs = actDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streakData.currentStreak += 1;
      streakData.lastLogDate = actDateStr;
    } else if (diffDays > 1) {
      streakData.currentStreak = 1;
      streakData.lastLogDate = actDateStr;
    }
  }

  if (streakData.currentStreak > streakData.longestStreak) {
    streakData.longestStreak = streakData.currentStreak;
  }

  try {
    localStorage.setItem("impactlens_streak", JSON.stringify(streakData));
  } catch (e) {}
}
