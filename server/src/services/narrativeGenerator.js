/**
 * narrativeGenerator.js — rule-based template narrative generator.
 *
 * ARCHITECTURE CONTRACT (from PRD Section 6):
 *  - Input: a structured "facts" object with pre-computed numbers only.
 *  - Output: a single string paragraph.
 *  - The generator NEVER performs calculations. Every number in the output
 *    must already exist, unchanged, in the facts object.
 *  - Every generated sentence is traceable to a specific facts field.
 *  - Swapping this function's implementation for a real LLM call requires
 *    zero changes to callers — the function signature is the interface boundary.
 *
 * UPGRADE PATH TO REAL LLM:
 *  Replace the body of generateGrantNarrative() and generateProgramNarrative()
 *  with an async call to your LLM API, passing the facts object as a structured
 *  prompt. The function signatures, facts object shapes, and all call sites
 *  remain unchanged.
 *
 * AI_ENABLED flag:
 *  Checked at the route level (not here). When AI_ENABLED=false, routes skip
 *  calling these functions and return { narrative: null, aiEnabled: false }.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct = (rate) => `${(rate * 100).toFixed(1)}%`;
const fmt = (n) => n.toLocaleString('en-IN');

function completionVerb(rate) {
  // Source field: facts.pblCompletionRate
  if (rate >= 0.90) return 'strong completion';
  if (rate >= 0.75) return 'solid progress on completion';
  if (rate >= 0.60) return 'partial completion';
  return 'low completion rates requiring acceleration';
}

function evidencePhrase(rate) {
  // Source field: facts.evidenceSubmissionRate
  if (rate >= 0.75) return 'evidence documentation is strong';
  if (rate >= 0.50) return 'evidence submission remains below target';
  return 'evidence submission requires urgent attention';
}

function attendancePhrase(rate) {
  // Source field: facts.attendanceRate
  if (rate >= 0.75) return 'healthy student attendance';
  if (rate >= 0.60) return 'attendance marginally below target';
  if (rate >= 0.35) return 'attendance that warrants intervention';
  return 'critically low attendance requiring immediate action';
}

function trendPhrase(trend) {
  // Source field: facts.trend (may be null for first month or single-month context)
  if (!trend || trend.prevMonth == null) return null;
  const parts = [];
  if (trend.completionDelta != null) {
    const dir = trend.completionDelta >= 0 ? 'improved' : 'declined';
    parts.push(`PBL completion ${dir} by ${pct(Math.abs(trend.completionDelta))} vs ${trend.prevMonth}`);
  }
  if (trend.attendanceDelta != null) {
    const dir = trend.attendanceDelta >= 0 ? 'rose' : 'fell';
    parts.push(`attendance ${dir} by ${pct(Math.abs(trend.attendanceDelta))}`);
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

function gapList(facts) {
  // Source fields: facts.pblCompletionRate, facts.evidenceSubmissionRate, facts.attendanceRate
  const gaps = [];
  if (facts.pblCompletionRate < 0.75) gaps.push('PBL completion');
  if (facts.evidenceSubmissionRate < 0.75) gaps.push('evidence submission');
  if (facts.attendanceRate < 0.60) gaps.push('student attendance');
  return gaps;
}

// ── Grant Narrative ───────────────────────────────────────────────────────────

/**
 * Generate a paragraph for a grant × month report section.
 *
 * @param {Object} facts
 * @param {string} facts.grantName          — e.g. "Learning Support Grant AA"
 * @param {string} facts.reportingMonth     — e.g. "2025-07"
 * @param {string[]} facts.coveredDistricts — e.g. ["District T","District G"]
 * @param {number} facts.sampledSchoolRecords
 * @param {number} facts.schoolsCompletedPbl
 * @param {number} facts.pblCompletionRate  — 0.0–1.0
 * @param {number} facts.schoolsWithEvidence
 * @param {number} facts.evidenceSubmissionRate — 0.0–1.0
 * @param {number} facts.totalEnrollment
 * @param {number} facts.totalAttendance
 * @param {number} facts.attendanceRate     — 0.0–1.0
 * @param {string} facts.riskStatus         — "On Track"|"Behind"|"At Risk"|"Critical"
 * @param {string} facts.reportStatus
 * @param {string} facts.milestoneSummary
 * @param {Object|null} facts.trend
 * @param {string|null} facts.trend.prevMonth
 * @param {number|null} facts.trend.completionDelta
 * @param {number|null} facts.trend.attendanceDelta
 * @returns {string}
 */
export function generateGrantNarrative(facts) {
  const {
    grantName,
    reportingMonth,
    coveredDistricts,
    sampledSchoolRecords,
    schoolsCompletedPbl,
    pblCompletionRate,
    schoolsWithEvidence,
    evidenceSubmissionRate,
    totalEnrollment,
    totalAttendance,
    attendanceRate,
    riskStatus,
    reportStatus,
    milestoneSummary,
    trend,
  } = facts;

  // Sentence 1: Overview — sources: grantName, reportingMonth, coveredDistricts
  const districtList =
    coveredDistricts.length <= 3
      ? coveredDistricts.join(', ')
      : `${coveredDistricts.slice(0, 3).join(', ')} and ${coveredDistricts.length - 3} other district${coveredDistricts.length - 3 > 1 ? 's' : ''}`;

  const s1 = `In ${reportingMonth}, ${grantName} continued implementation across ${districtList} covering ${fmt(sampledSchoolRecords)} sampled school records.`;

  // Sentence 2: Completion — sources: schoolsCompletedPbl, sampledSchoolRecords, pblCompletionRate
  const s2 = `The program recorded ${completionVerb(pblCompletionRate)}, with ${fmt(schoolsCompletedPbl)} of ${fmt(sampledSchoolRecords)} schools (${pct(pblCompletionRate)}) completing PBL sessions.`;

  // Sentence 3: Evidence — sources: schoolsWithEvidence, schoolsCompletedPbl, evidenceSubmissionRate
  const s3 = `On documentation, ${evidencePhrase(evidenceSubmissionRate)}: ${fmt(schoolsWithEvidence)} of ${fmt(schoolsCompletedPbl)} participating schools (${pct(evidenceSubmissionRate)}) submitted evidence packages.`;

  // Sentence 4: Attendance — sources: totalAttendance, totalEnrollment, attendanceRate
  const s4 = `Student engagement showed ${attendancePhrase(attendanceRate)}, with ${fmt(totalAttendance)} student sessions recorded against an enrolled base of ${fmt(totalEnrollment)} (overall rate: ${pct(attendanceRate)}).`;

  // Sentence 5 (conditional): Trend — sources: trend.*
  const trendText = trendPhrase(trend);
  const s5 = trendText ? `Compared to the previous reporting period, ${trendText}.` : null;

  // Sentence 6: Risk status — sources: riskStatus
  const gaps = gapList(facts);
  const gapText = gaps.length > 0 ? ` Priority attention is needed on: ${gaps.join(', ')}.` : ' The program is performing well across all tracked dimensions.';
  const s6 = `Overall grant status is classified as ${riskStatus}.${gapText}`;

  // Sentence 7 (conditional): Milestones — source: milestoneSummary
  const s7 = milestoneSummary ? `Milestone update: ${milestoneSummary}.` : null;

  // Sentence 8: Report status — source: reportStatus
  const s8 = reportStatus ? `Report status: ${reportStatus}.` : null;

  return [s1, s2, s3, s4, s5, s6, s7, s8].filter(Boolean).join(' ');
}

// ── Program Narrative (Tier 2) ────────────────────────────────────────────────

/**
 * Generate a paragraph for a program scope (month + optional district/block).
 *
 * @param {Object} facts
 * @param {string} facts.scope           — "July 2025 · District A · Block 001" etc.
 * @param {number} facts.totalSchools
 * @param {number} facts.participatingSchools
 * @param {number} facts.participationRate  — 0.0–1.0
 * @param {number} facts.evidenceRate       — 0.0–1.0 (among participants)
 * @param {number} facts.attendanceRate     — 0.0–1.0 (among participants)
 * @param {string} facts.geographyRiskLabel
 * @param {Object} facts.riskDistribution  — { onTrack, behind, atRisk, critical }
 * @param {string|null} facts.topGap        — worst-performing sub-geography name
 * @param {Object|null} facts.trend
 * @returns {string}
 */
export function generateProgramNarrative(facts) {
  const {
    scope,
    totalSchools,
    participatingSchools,
    participationRate,
    evidenceRate,
    attendanceRate,
    geographyRiskLabel,
    riskDistribution,
    topGap,
    trend,
  } = facts;

  // Sentence 1: Scope + participation — sources: scope, participatingSchools, totalSchools, participationRate
  const s1 = `For ${scope}, ${fmt(participatingSchools)} of ${fmt(totalSchools)} schools (${pct(participationRate)}) conducted PBL sessions this period.`;

  // Sentence 2: Evidence — sources: evidenceRate
  const s2 = `Among participating schools, ${evidencePhrase(evidenceRate)} (${pct(evidenceRate)}).`;

  // Sentence 3: Attendance — sources: attendanceRate
  const s3 = `Student sessions showed ${attendancePhrase(attendanceRate)}, with an average attendance rate of ${pct(attendanceRate)} across active schools.`;

  // Sentence 4: Risk distribution — sources: riskDistribution.*
  const rd = riskDistribution;
  const s4 =
    `Risk distribution: ${rd.onTrack} schools On Track, ${rd.behind} Behind, ` +
    `${rd.atRisk} At Risk, and ${rd.critical} Critical (includes non-participants).`;

  // Sentence 5 (conditional): Trend — sources: trend.*
  const trendText = trendPhrase(trend);
  const s5 = trendText ? `Month-over-month: ${trendText}.` : null;

  // Sentence 6: Overall status — sources: geographyRiskLabel
  const gaps = [];
  if (participationRate < 0.75) gaps.push('participation');
  if (evidenceRate < 0.75) gaps.push('evidence submission');
  if (attendanceRate < 0.60) gaps.push('attendance');
  const gapClause = gaps.length > 0 ? ` Focus areas: ${gaps.join(', ')}.` : ' All indicators are within target.';
  const s6 = `Overall status: ${geographyRiskLabel}.${gapClause}`;

  // Sentence 7 (conditional): Worst geography — source: topGap
  const s7 = topGap ? `${topGap} shows the weakest combined performance and is recommended for priority follow-up this cycle.` : null;

  return [s1, s2, s3, s4, s5, s6, s7].filter(Boolean).join(' ');
}
