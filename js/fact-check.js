/**
 * Fact-checker — compares AI-cited figures against audited ground truth.
 */

const FACT_CHECK_TOLERANCE = 1;

const GROUND_TRUTH_LABEL_MAP = {
  "Total CO2 Offset": (summary) => summary.totalCO2,
  "Waste Recycled": (summary) => summary.totals["Waste Recycled"],
  "Trees Planted": (summary) => summary.totals["Trees Planted"],
  "Sustainable Meals": (summary) => summary.totals["Sustainable Meals"],
  "Distance Biked": (summary) => summary.totals["Distance Biked"],
  "Electricity Saved": (summary) => summary.totals["Electricity Saved"],
  "Water Saved": (summary) => summary.totals["Water Saved"]
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getGroundTruthValue(label, summary) {
  if (GROUND_TRUTH_LABEL_MAP[label]) {
    const value = GROUND_TRUTH_LABEL_MAP[label](summary);
    return parseFloat(value) || 0;
  }

  if (summary.totals && summary.totals[label] !== undefined) {
    return parseFloat(summary.totals[label]) || 0;
  }

  return 0;
}

function isWithinTolerance(citedValue, actualValue) {
  const cited = parseFloat(citedValue);
  const actual = parseFloat(actualValue);
  if (Number.isNaN(cited) || Number.isNaN(actual)) return false;
  return Math.abs(cited - actual) <= FACT_CHECK_TOLERANCE;
}

function formatFigureValue(value) {
  const num = parseFloat(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function runFactCheck(citedFigures, summary) {
  const panel = document.getElementById("fact-check-panel");
  if (!panel) return;

  if (!Array.isArray(citedFigures) || citedFigures.length === 0) {
    panel.innerHTML = "";
    panel.className = "fact-check-panel hidden";
    return;
  }

  const results = citedFigures.map((figure) => {
    const actualValue = getGroundTruthValue(figure.label, summary);
    const verified = isWithinTolerance(figure.value, actualValue);

    return {
      label: figure.label,
      unit: figure.unit || "",
      citedValue: figure.value,
      actualValue,
      verified
    };
  });

  const verifiedCount = results.filter((r) => r.verified).length;
  const totalCount = results.length;
  const allVerified = verifiedCount === totalCount;

  const badgeClass = allVerified ? "fact-check-badge--verified" : "fact-check-badge--partial";
  const badgeIcon = allVerified ? "fa-circle-check" : "fa-triangle-exclamation";

  const rows = results
    .map((result) => {
      const statusClass = result.verified ? "fact-check-item--verified" : "fact-check-item--flagged";
      const statusIcon = result.verified ? "fa-circle-check" : "fa-triangle-exclamation";
      const statusLabel = result.verified ? "Verified" : "Flagged";

      return `
        <li class="fact-check-item ${statusClass}">
          <div class="fact-check-item__status">
            <i class="fa-solid ${statusIcon}" aria-hidden="true"></i>
            <span>${statusLabel}</span>
          </div>
          <div class="fact-check-item__label">${escapeHtml(result.label)}</div>
          <div class="fact-check-item__values">
            <span class="fact-check-item__cited">
              Cited: <strong>${escapeHtml(formatFigureValue(result.citedValue))}</strong> ${escapeHtml(result.unit)}
            </span>
            <span class="fact-check-item__actual">
              Source: <strong>${escapeHtml(formatFigureValue(result.actualValue))}</strong> ${escapeHtml(result.unit)}
            </span>
          </div>
        </li>`;
    })
    .join("");

  panel.className = "fact-check-panel";
  panel.innerHTML = `
    <div class="fact-check-header">
      <h4><i class="fa-solid fa-shield-halved"></i> AI Fact-Check</h4>
      <span class="fact-check-badge ${badgeClass}">
        <i class="fa-solid ${badgeIcon}"></i>
        ${verifiedCount} of ${totalCount} figures verified
      </span>
    </div>
    <ul class="fact-check-list">${rows}</ul>`;
}
