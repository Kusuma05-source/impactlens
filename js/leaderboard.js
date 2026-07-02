const API_KEY = 'YOUR_API_KEY_HERE';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
const CACHE_KEY = 'impactlens_user_highlights';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

document.addEventListener("DOMContentLoaded", () => {
  loadLeaderboardData();
});

async function getUserHighlight(userName, userActivities) {
  // Check cache
  let cache = {};
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
      cache = JSON.parse(cachedData);
    }
  } catch(e) {}

  const now = Date.now();
  if (cache[userName] && cache[userName].timestamp && (now - cache[userName].timestamp < CACHE_EXPIRY_MS)) {
    return cache[userName].highlight;
  }

  // Fallback if no API key is provided
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    if (!userActivities || userActivities.length === 0) {
      return "Making moves for a greener planet!";
    }
    const counts = {};
    userActivities.forEach(a => {
      counts[a.activity] = (counts[a.activity] || 0) + (parseFloat(a.quantity) || 0);
    });
    const topCategory = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
    const fallbackText = `Crushing it in ${topCategory.replace(/([A-Z])/g, ' $1').toLowerCase()} and making real waves!`;
    return fallbackText;
  }

  // AI Generation
  const prompt = `You are a hype-person for a Gen-Z sustainability app. 
Review the following user's eco-activity data:
User: ${userName}
Activities: ${JSON.stringify(userActivities.map(a => ({ activity: a.activity, quantity: a.quantity })))}

Write a single, punchy, Gen-Z friendly highlight sentence summarizing their impact. (e.g. "${userName} is crushing it with 15km of eco-commuting this week!"). Do not use hashtags or emojis unless absolutely necessary. Keep it under 15 words.`;

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const highlight = data.candidates[0].content.parts[0].text.trim();
      
      // Update cache
      cache[userName] = {
        highlight: highlight,
        timestamp: now
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return highlight;
    } else {
      throw new Error("API response not ok");
    }
  } catch (error) {
    console.error("Failed to fetch highlight from Gemini:", error);
    return "Making moves for a greener planet!";
  }
}

async function loadLeaderboardData() {
  let data = { ...FALLBACK_DATA };

  try {
    const response = await fetch("../data/sample-data.json");
    if (response.ok) {
      data = await response.json();
    }
  } catch (err) {}

  // Merge local storage activities
  try {
    const storedLocal = localStorage.getItem("impactlens_activities");
    if (storedLocal) {
      const localActivities = JSON.parse(storedLocal);
      if (Array.isArray(localActivities)) {
        data.activities = [...data.activities, ...localActivities];
      }
    }
  } catch (err) {}
  data.activities = data.activities || [];
  data.conversionRates = data.conversionRates || {};
  data.leaderboard = data.leaderboard || [];

  // Calculate dynamic values for Team Lumen
  let lumenTotalOffset = 0;
  const userOffsets = {
    "Elena Vance": 0,
    "Marcus Fenix": 0,
    "Kusuma": 0,
    "Sarah Connor": 0,
    "Lumen Leader": 0
  };

  data.activities.forEach(act => {
    if (!act || !act.activity) return;
    const rateInfo = data.conversionRates[act.activity];
    if (rateInfo) {
      const qty = parseFloat(act.quantity) || 0;
      const rate = parseFloat(rateInfo.rate) || 0;
      const offset = qty * rate;
      if (act.team === "Lumen") {
        lumenTotalOffset += offset;
        
        // Track individual contributor
        const loggedBy = act.loggedBy || "Unknown";
        if (userOffsets[loggedBy] !== undefined) {
          userOffsets[loggedBy] += offset;
        } else {
          userOffsets[loggedBy] = offset;
        }
      }
    }
  });

  // Update Lumen score in the leaderboard array
  const teamList = data.leaderboard.map(team => {
    if (team.team === "Lumen") {
      return { ...team, totalCO2Offset: lumenTotalOffset };
    }
    return team;
  });

  // Sort teams descending by offset
  teamList.sort((a, b) => b.totalCO2Offset - a.totalCO2Offset);

  // Render Teams
  const teamContainer = document.getElementById("team-list");
  if (teamContainer) {
    teamContainer.innerHTML = "";
    
    teamList.forEach((team, idx) => {
      const rank = idx + 1;
      let rankClass = "rank-num";
      if (rank <= 3) rankClass += ` rank-${rank}`;

      const isLumen = team.team === "Lumen";
      const itemClass = isLumen ? "leaderboard-item highlight" : "leaderboard-item";
      
      const div = document.createElement("div");
      div.className = itemClass;
      div.innerHTML = `
        <div class="${rankClass}">${rank}</div>
        <div class="item-avatar">${team.team.substring(0, 2).toUpperCase()}</div>
        <div class="item-info">
          <span class="item-title">${team.team} ${isLumen ? '<span style="font-size: 0.75rem; background: var(--accent-primary); color: var(--bg-primary); padding: 0.15rem 0.4rem; border-radius: 4px; margin-left: 0.35rem; font-weight: bold;">YOUR TEAM</span>' : ''}</span>
          <span class="item-subtitle">${team.members} Active Contributors</span>
        </div>
        <div class="item-score">${team.totalCO2Offset.toFixed(1)}<span>kg</span></div>
      `;
      teamContainer.appendChild(div);
    });
  }

  // Render Users
  const userContainer = document.getElementById("user-list");
  if (userContainer) {
    userContainer.innerHTML = "";

    // Convert userOffsets to list and sort
    const userList = Object.keys(userOffsets).map(name => {
      return { name: name, offset: userOffsets[name] };
    });
    userList.sort((a, b) => b.offset - a.offset);

    for (let idx = 0; idx < userList.length; idx++) {
      const user = userList[idx];
      const rank = idx + 1;
      
      // Get Initials
      const initials = user.name.split(" ").map(n => n[0]).join("");

      // Create Card
      const div = document.createElement("div");
      div.className = "player-card";
      div.innerHTML = `
        <div class="player-card-header">
          <div class="player-rank">#${rank}</div>
          <div class="player-avatar">${initials}</div>
          <div class="player-info">
            <div class="player-name">${user.name}</div>
            <div class="player-team">Team Lumen</div>
          </div>
          <div class="player-score-container">
            <div class="player-score">${user.offset.toFixed(1)}<span>kg</span></div>
          </div>
        </div>
        <div class="player-highlight">
          <i class="fa-solid fa-sparkles"></i>
          <span class="loading-highlight">Generating impact summary...</span>
        </div>
      `;
      userContainer.appendChild(div);

      // Get user specific activities
      const userActs = data.activities.filter(a => a.loggedBy === user.name);
      
      // Fetch highlight asynchronously
      getUserHighlight(user.name, userActs).then(highlightText => {
        const highlightSpan = div.querySelector('.player-highlight span');
        if (highlightSpan) {
          highlightSpan.className = "";
          highlightSpan.textContent = highlightText;
        }
      });
    }
  }
}
