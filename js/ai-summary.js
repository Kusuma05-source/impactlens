/**
 * AI Summary Generator Module
 * Simulates prompting an LLM with metrics data and formatting a professional report.
 */

// Generate the prompt that would be sent to the AI model
function compileAIPrompt(summary) {
  return `You are a professional sustainability consultant auditing Team Lumen's environmental data for SDG 12 & 13.
Analyze these activity logs:
- Waste Recycled: ${summary.totals["Waste Recycled"].toFixed(0)} kg (Offset: ${summary.categoryOffsets["Waste"].toFixed(1)} kg CO2e)
- Trees Planted: ${summary.totals["Trees Planted"].toFixed(0)} units (Offset: ${summary.categoryOffsets["Forestry"].toFixed(1)} kg CO2e)
- Distance Biked: ${summary.totals["Distance Biked"].toFixed(0)} km (Offset: ${summary.categoryOffsets["Transport"].toFixed(1)} kg CO2e)
- Electricity Saved: ${summary.totals["Electricity Saved"].toFixed(0)} kWh (Offset: ${summary.categoryOffsets["Energy"].toFixed(1)} kg CO2e)
- Water Saved: ${summary.totals["Water Saved"].toFixed(0)} L (Offset: ${summary.categoryOffsets["Water"].toFixed(1)} kg CO2e)

Total Carbon Mitigation: ${summary.totalCO2.toFixed(1)} kg CO2e.

INSTRUCTIONS:
1. Write a professional executive summary paragraph (120-150 words).
2. Highlight key figures in **bold**.
3. Detail how these metrics directly support SDG 12 (Responsible Consumption) and SDG 13 (Climate Action).
4. Identify the highest-impact activity and make one constructive recommendation.`;
}

// Generate the customized narrative response based on the actual numbers
function generateExecutiveSummaryText(summary) {
  const total = summary.totalCO2.toFixed(1);
  const waste = summary.totals["Waste Recycled"].toFixed(0);
  const water = summary.totals["Water Saved"].toFixed(0);
  const energy = summary.totals["Electricity Saved"].toFixed(0);
  const biked = summary.totals["Distance Biked"].toFixed(0);
  const trees = summary.totals["Trees Planted"].toFixed(0);
  
  // Find highest category
  let maxCat = "Forestry";
  let maxOffset = summary.categoryOffsets["Forestry"];
  
  Object.keys(summary.categoryOffsets).forEach(cat => {
    if (summary.categoryOffsets[cat] > maxOffset) {
      maxOffset = summary.categoryOffsets[cat];
      maxCat = cat;
    }
  });

  const categoryNameMap = {
    "Forestry": "Forestry and reforestation",
    "Energy": "Energy conservation",
    "Waste": "Waste diversion",
    "Transport": "Eco-commuting",
    "Water": "Water resource conservation"
  };

  const maxCatName = categoryNameMap[maxCat] || maxCat;

  return `<strong>Executive Audit Statement:</strong> Team Lumen has demonstrated outstanding progress in carbon emission avoidance during the auditing period, successfully mitigating a cumulative total of <strong>${total} kg CO2e</strong>. These actions directly support <strong>SDG 13 (Climate Action)</strong> and <strong>SDG 12 (Responsible Consumption & Production)</strong>. The primary driver of this reduction was <strong>${maxCatName}</strong>, achieving a substantial offset of <strong>${maxOffset.toFixed(1)} kg CO2e</strong>, largely due to planting <strong>${trees} trees</strong> and saving <strong>${energy} kWh of energy</strong>. 
  
  Resource management efforts further yielded significant landfill diversion of <strong>${waste} kg of waste</strong> alongside conserving <strong>${water} Liters of water</strong>. In addition, <strong>${biked} km</strong> logged via bicycle commuting reduced grid transit strain. 
  
  <blockquote><strong>Recommendation:</strong> While energy and forestry baselines are highly favorable, upgrading recycling guidelines to capture organic compostable materials could improve waste diversion rates by up to 25% next quarter.</blockquote>`;
}

// Simulate the AI compilation steps
function triggerAISimulation(summary, outputElement, promptElement, btnElement) {
  if (!outputElement || !btnElement) return;

  // 1. Prepare button state
  btnElement.disabled = true;
  btnElement.classList.add("loading");
  btnElement.innerHTML = `<i class="fa-solid fa-spinner"></i> Analysing Data...`;

  // 2. Prepare prompt display
  const promptText = compileAIPrompt(summary);
  if (promptElement) {
    const previewContainer = document.getElementById("prompt-preview");
    if (previewContainer) previewContainer.style.display = "flex";
    document.getElementById("prompt-text").textContent = promptText;
  }

  // 3. Clear output box and show progressive loading stages
  outputElement.innerHTML = "";
  outputElement.className = "ai-output-box generating";

  const stages = [
    "Formulating LLM system instructions...",
    "Injecting 5 audited logs & baseline coefficients...",
    "Evaluating carbon mitigation benchmarks (SDG 12/13)...",
    "Writing executive statements in advisory tone..."
  ];

  let currentStageIndex = 0;
  
  const stageInterval = setInterval(() => {
    if (currentStageIndex < stages.length) {
      outputElement.innerHTML = `<p class="placeholder-text"><i class="fa-solid fa-gear fa-spin" style="color: var(--accent-secondary);"></i> ${stages[currentStageIndex]}</p>`;
      currentStageIndex++;
    } else {
      clearInterval(stageInterval);
      
      // 4. Type out the actual AI summary response
      const summaryHTML = generateExecutiveSummaryText(summary);
      outputElement.innerHTML = "";
      
      let charIndex = 0;
      // We will inject the HTML tags in blocks to make it look like a smooth typing effect
      // For simplicity and speed, let's render the text over a fast interval or fade it in with typing style
      outputElement.className = "ai-output-box";
      
      // Fade in the finalized text nicely
      outputElement.style.opacity = 0;
      outputElement.innerHTML = summaryHTML;
      
      let opacity = 0;
      const fadeIn = setInterval(() => {
        if (opacity < 1) {
          opacity += 0.08;
          outputElement.style.opacity = opacity;
        } else {
          clearInterval(fadeIn);
          // Restore button
          btnElement.disabled = false;
          btnElement.classList.remove("loading");
          btnElement.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Re-generate Summary`;
        }
      }, 30);
    }
  }, 900);
}
