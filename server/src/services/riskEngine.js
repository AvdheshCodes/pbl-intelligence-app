/**
 * riskEngine.js — deterministic risk classification.
 *
 * DESIGN CONTRACTS:
 *  - Zero I/O: no DB calls, no network calls, no file reads inside any function.
 *  - All inputs are plain JavaScript values.
 *  - All outputs are plain JavaScript objects with a `label` and `reason` string.
 *  - Fully unit-testable in isolation.
 *
 * GEOGRAPHY-LEVEL AGGREGATION RULE (documented design decision):
 *  We compute the average attendance rate across *participating* schools
 *  (conducted=true) in the geography, then apply the same four-band thresholds
 *  to that average. Non-participating schools are excluded from this average
 *  because their zero attendance is a *participation* failure, not an
 *  *engagement* failure — the two signals are surfaced separately in the API
 *  response as `avgAttendanceRate` and `participationRate`.
 *
 *  Rationale for choosing average-then-threshold over mode-of-risk-bands:
 *   - A single numeric average is more comparable across geographies of
 *     different sizes (mode is sensitive to geography size).
 *   - It's directly explainable: "District X is At Risk because the average
 *     attendance across its 42 participating schools is 51%, which falls in
 *     the 35–60% band."
 *   - It matches how the school-level formula works, making the system coherent.
 */

// ── Thresholds (verbatim from PRD, verified against all CSV rows) ─────────────
const THRESHOLDS = [
  { min: 0.75, max: Infinity, label: 'On Track' },
  { min: 0.60, max: 0.75, label: 'Behind' },
  { min: 0.35, max: 0.60, label: 'At Risk' },
  { min: -Infinity, max: 0.35, label: 'Critical' },
];

/**
 * Classify a single school's attendance rate into a risk band.
 *
 * @param {number} attendanceRate  — float 0.0–1.0 (or 0 for non-conducted schools)
 * @returns {{ label: string, reason: string }}
 */
export function classifySchoolRisk(attendanceRate) {
  const rate = typeof attendanceRate === 'number' ? attendanceRate : parseFloat(attendanceRate) || 0;

  for (const band of THRESHOLDS) {
    if (rate >= band.min && rate < band.max) {
      return {
        label: band.label,
        reason: `Attendance rate ${(rate * 100).toFixed(1)}% falls in the ${formatBand(band)} band`,
      };
    }
  }

  // Fallback — should never be reached given the -Infinity lower bound
  return { label: 'Critical', reason: `Attendance rate ${(rate * 100).toFixed(1)}% is below all thresholds` };
}

/**
 * Classify a geography (district or block) given its participating school rows.
 *
 * @param {Array<{ conducted: boolean, attendanceRate: number }>} schools
 *   — array of school-response documents for the geography
 * @returns {{
 *   label: string,
 *   reason: string,
 *   avgAttendanceRate: number,   — avg attendance among participating schools
 *   participationRate: number,   — % of all schools that conducted PBL
 *   totalSchools: number,
 *   participatingSchools: number,
 *   riskDistribution: { onTrack: number, behind: number, atRisk: number, critical: number }
 * }}
 */
export function classifyGeographyRisk(schools) {
  const totalSchools = schools.length;
  const participating = schools.filter((s) => s.conducted);
  const participatingSchools = participating.length;
  const participationRate = totalSchools > 0 ? participatingSchools / totalSchools : 0;

  // Attendance rate: average over participating schools only
  const avgAttendanceRate =
    participatingSchools > 0
      ? participating.reduce((sum, s) => sum + (s.attendanceRate || 0), 0) / participatingSchools
      : 0;

  // Apply school-level thresholds to the geography average
  const { label, reason: schoolReason } = classifySchoolRisk(avgAttendanceRate);
  const reason =
    `${label} — avg attendance among ${participatingSchools} participating schools is ` +
    `${(avgAttendanceRate * 100).toFixed(1)}% (${schoolReason.toLowerCase()}). ` +
    `Participation rate: ${(participationRate * 100).toFixed(1)}% (${participatingSchools}/${totalSchools} schools).`;

  // Risk distribution counts across ALL schools (including non-participants, which are Critical)
  const riskDistribution = { onTrack: 0, behind: 0, atRisk: 0, critical: 0 };
  for (const s of schools) {
    const { label: sLabel } = classifySchoolRisk(s.attendanceRate);
    if (sLabel === 'On Track') riskDistribution.onTrack++;
    else if (sLabel === 'Behind') riskDistribution.behind++;
    else if (sLabel === 'At Risk') riskDistribution.atRisk++;
    else riskDistribution.critical++;
  }

  return {
    label,
    reason,
    avgAttendanceRate,
    participationRate,
    totalSchools,
    participatingSchools,
    riskDistribution,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBand(band) {
  if (band.min === -Infinity) return `below ${(band.max * 100).toFixed(0)}%`;
  if (band.max === Infinity) return `above ${(band.min * 100).toFixed(0)}%`;
  return `${(band.min * 100).toFixed(0)}–${(band.max * 100).toFixed(0)}%`;
}

/**
 * Sort risk labels by severity (worst first).
 * Useful for defaulting table views to "worst first."
 */
export const RISK_SEVERITY = { Critical: 0, 'At Risk': 1, Behind: 2, 'On Track': 3 };

export function riskSeverityComparator(a, b) {
  return (RISK_SEVERITY[a.label] ?? 4) - (RISK_SEVERITY[b.label] ?? 4);
}
