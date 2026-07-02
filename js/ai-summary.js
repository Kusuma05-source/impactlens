/**
 * AI Summary Generator — Team Lumen, ImpactLens
 * Calls Gemini for narrative prose; all figures come from audited local metrics.
 */

function getGeminiEndpoint() {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.GEMINI_API_KEY}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roundMetric(value, decimals) {
  const num = parseFloat(value) || 0;
  return Number(num.toFixed(decimals));
}

function buildVerifiedFigures(summary) {
  return [
    { label: "Total CO2 Offset", value: roundMetric(summary.totalCO2, 1), unit: "kg CO2e" },
    { label: "Waste Recycled", value: roundMetric(summary.totals["Waste Recycled"], 0), unit: "kg" },
    { label: "Sustainable Meals", value: roundMetric(summary.totals["Sustainable Meals"], 0), unit: "meals" },
    { label: "Distance Biked", value: roundMetric(summary.totals["Distance Biked"], 0), unit: "km" },
    { label: "Electricity Saved", value: roundMetric(summary.totals["Electricity Saved"], 0), unit: "kWh" },
    { label: "Water Saved", value: roundMetric(summary.totals["Water Saved"], 0), unit: "L" }
  ];
}

function findHighestImpactCategory(summary) {
  const categoryLabels = {
    Waste: "waste diversion",
    Food: "sustainable meals",
    Transport: "eco-commuting",
    Energy: "energy conservation",
    Water: "water conservation"
  };

  let topCategory = "Food";
  let topOffset = summary.categoryOffsets["Food"] || 0;

  Object.entries(summary.categoryOffsets || {}).forEach(([category, offset]) => {
    if (offset > topOffset) {
      topOffset = offset;
      topCategory = category;
    }
  });

  return {
    category: topCategory,
    label: categoryLabels[topCategory] || topCategory,
    offset: roundMetric(topOffset, 1)
  };
}

function compileAIPrompt(summary, figures, topImpact) {
  const figureLines = figures.map((f) => `- ${f.label}: ${f.value} ${f.unit}`).join("\n");
  const offsetLines = Object.entries(summary.categoryOffsets || {})
    .map(([cat, val]) => `- ${cat}: ${roundMetric(val, 1)} kg CO2e`)
    .join("\n");

  return `You are a professional sustainability consultant writing an executive audit summary for Team Lumen.

AUDITED FIGURES (use these numbers exactly — do not invent or round differently):
${figureLines}

Category CO2 offsets:
${offsetLines}

Highest-impact category: ${topImpact.category} (${topImpact.offset} kg CO2e from ${topImpact.label})

Write:
1. A 120-150 word executive summary referencing the audited figures above. Mention SDG 12 (Responsible Consumption and Production) and SDG 13 (Climate Action).
2. One specific recommendation to improve ${topImpact.label} further.

Rules:
- Use ONLY the audited numbers listed above.
- Do not wrap the response in markdown or code fences.
- Return JSON with three fields: "narrative" (string), "recommendation" (string), and "citedFigures" (array of exactly six objects, each with "label", "value", and "unit").
- The citedFigures array must use these labels exactly: "Total CO2 Offset", "Waste Recycled", "Trees Planted", "Distance Biked", "Electricity Saved", "Water Saved".
- Populate each citedFigures value field with the exact number you cite for that metric in the narrative.`;
}

function parseGeminiJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty response from Gemini");
  }

  const attempts = [
    () => JSON.parse(rawText.trim()),
    () => JSON.parse(rawText.replace(/```json\s*|```/gi, "").trim()),
    () => {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found");
      return JSON.parse(match[0]);
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (parsed && typeof parsed.narrative === "string" && typeof parsed.recommendation === "string") {
        return parsed;
      }
      throw new Error("Response missing narrative or recommendation fields");
    } catch (err) {
      lastError = err;
    }
  }

  console.error("Gemini rawText before parse:", rawText);
  throw lastError || new Error("Could not parse Gemini response");
}

function buildVerifiedFiguresHtml(figures) {
  const rows = figures
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.label)}</td><td><strong>${escapeHtml(f.value)}</strong> ${escapeHtml(f.unit)}</td></tr>`
    )
    .join("");

  return `
    <div class="ai-verified-figures">
      <strong>Verified Source Figures</strong>
      <table class="ai-figures-table">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function buildFallbackSummary(figures, topImpact) {
  const total = figures.find((f) => f.label === "Total CO2 Offset");
  const waste = figures.find((f) => f.label === "Waste Recycled");
  const meals = figures.find((f) => f.label === "Sustainable Meals");
  const biked = figures.find((f) => f.label === "Distance Biked");
  const energy = figures.find((f) => f.label === "Electricity Saved");
  const water = figures.find((f) => f.label === "Water Saved");

  return {
    narrative: `Team Lumen's audited activity logs show a total carbon mitigation of ${total.value} ${total.unit} across all tracked categories. Waste diversion reached ${waste.value} ${waste.unit}, sustainable dining logged ${meals.value} ${meals.unit}, eco-commuting covered ${biked.value} ${biked.unit}, energy savings totaled ${energy.value} ${energy.unit}, and water conservation reached ${water.value} ${water.unit}. The strongest contributor was ${topImpact.label}, delivering ${topImpact.offset} kg CO2e. These results align with SDG 12 (Responsible Consumption and Production) through resource efficiency and SDG 13 (Climate Action) through measurable emissions avoidance.`,
    recommendation: `Expand ${topImpact.label} initiatives with clear weekly targets and team accountability, since this category currently delivers the largest verified CO2 offset at ${topImpact.offset} kg CO2e.`
  };
}

function renderSummaryOutput(narrative, recommendation, figures, usedFallback) {
  const notice = usedFallback
    ? `<p class="ai-fallback-note"><i class="fa-solid fa-circle-info"></i> Generated from verified audit data (AI formatting unavailable).</p>`
    : "";

  return `
    ${notice}
    <strong>Executive Audit Statement:</strong>
    <p>${escapeHtml(narrative)}</p>
    <blockquote><strong>Recommendation:</strong> ${escapeHtml(recommendation)}</blockquote>
    ${buildVerifiedFiguresHtml(figures)}`;
}

async function callGeminiAPI(prompt) {
  const response = await fetch(getGeminiEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            narrative: {
              type: "STRING",
              description: "120-150 word executive summary using only audited figures. Mention SDG 12 and SDG 13."
            },
            recommendation: {
              type: "STRING",
              description: "One actionable recommendation for the highest-impact category."
            },
            citedFigures: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  value: { type: "NUMBER" },
                  unit: { type: "STRING" }
                }
              }
            }
          },
          required: ["narrative", "recommendation"]
        }
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini error ${response.status}: ${err.error?.message || "unknown"}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseGeminiJson(rawText);
}

async function triggerAISummary(summary, outputElement, promptElement, btnElement) {
  if (!outputElement || !btnElement) return;

  if (!window.GEMINI_API_KEY) {
    outputElement.innerHTML = `<p style="color:#ef4444;">⚠️ No API key found. Add your Gemini key to js/config.js</p>`;
    outputElement.className = "ai-output-box";
    return;
  }

  const verifiedFigures = buildVerifiedFigures(summary);
  const topImpact = findHighestImpactCategory(summary);
  const promptText = compileAIPrompt(summary, verifiedFigures, topImpact);

  btnElement.disabled = true;
  btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Calling Gemini...`;
  outputElement.innerHTML = `<p class="placeholder-text"><i class="fa-solid fa-gear fa-spin"></i> Waiting for Gemini response...</p>`;
  outputElement.className = "ai-output-box generating";

  if (promptElement) {
    const previewContainer = document.getElementById("prompt-preview");
    if (previewContainer) previewContainer.style.display = "flex";
    document.getElementById("prompt-text").textContent = promptText;
  }

  try {
    let narrative;
    let recommendation;
    let usedFallback = false;
    let result;

    try {
      result = await callGeminiAPI(promptText);
      narrative = result.narrative.trim();
      recommendation = result.recommendation.trim();
    } catch (apiError) {
      console.warn("Gemini call failed, using verified fallback summary:", apiError);
      const fallback = buildFallbackSummary(verifiedFigures, topImpact);
      narrative = fallback.narrative;
      recommendation = fallback.recommendation;
      usedFallback = apiError.message.includes("parse") || apiError instanceof SyntaxError;
      if (!usedFallback) throw apiError;
    }

    outputElement.innerHTML = renderSummaryOutput(narrative, recommendation, verifiedFigures, usedFallback);
    outputElement.className = "ai-output-box";
    outputElement.dataset.citedFigures = JSON.stringify(verifiedFigures);

    if (typeof runFactCheck === "function") {
      runFactCheck(result.citedFigures, summary);
    }
  } catch (error) {
    console.error("AI Summary failed:", error);
    outputElement.innerHTML = `
      <p style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i>
        Generation failed: ${escapeHtml(error.message)}
      </p>
      <p style="color:#9ca3af; font-size:0.85rem;">Check your API key and open the browser console (F12) for details.</p>
    `;
    outputElement.className = "ai-output-box";
  } finally {
    btnElement.disabled = false;
    btnElement.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Re-generate Summary`;
  }
}
