/**
 * routes/programReport.js (Tier 2 — Program Reporting Assistant)
 *
 * POST /api/program-report/generate
 * Body: { month: "2025-07", district?: "District A", block?: "District A - Block 001" }
 *
 * Aggregates school data for the given scope, builds a ProgramFacts object,
 * and passes it to generateProgramNarrative(). Reuses the same narrative engine
 * as the grant report, demonstrating the engine generalizes across scopes.
 */

import express from 'express';
import SchoolResponse from '../models/SchoolResponse.js';
import { classifyGeographyRisk } from '../services/riskEngine.js';
import { generateProgramNarrative } from '../services/narrativeGenerator.js';

const router = express.Router();
const AI_ENABLED = process.env.AI_ENABLED !== 'false';

const MONTHS = ['2025-07', '2025-08', '2025-09'];
const MONTH_LABELS = { '2025-07': 'July 2025', '2025-08': 'August 2025', '2025-09': 'September 2025' };

function buildFilter({ month, district, block }) {
  const filter = {};
  if (month && month !== 'All') filter.reportingMonth = month;
  if (district && district !== 'All') filter.district = district;
  if (block && block !== 'All') filter.block = block;
  return filter;
}

function scopeLabel({ month, district, block }) {
  const parts = [
    month && month !== 'All' ? (MONTH_LABELS[month] || month) : 'All Months',
    district && district !== 'All' ? district : null,
    block && block !== 'All' ? block : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

async function buildProgramFacts(params) {
  const { month, district, block } = params;
  const filter = buildFilter(params);
  const schools = await SchoolResponse.find(filter).lean();

  if (schools.length === 0) return null;

  const geo = classifyGeographyRisk(schools);

  // Evidence rate among participants
  const participatingSchools = schools.filter((s) => s.conducted);
  const evidenceCount = participatingSchools.filter((s) => s.evidenceSubmitted).length;
  const evidenceRate = participatingSchools.length > 0 ? evidenceCount / participatingSchools.length : 0;

  // Trend — compare with previous month if a specific month is selected
  let trend = null;
  if (month && month !== 'All') {
    const currentIdx = MONTHS.indexOf(month);
    if (currentIdx > 0) {
      const prevMonth = MONTHS[currentIdx - 1];
      const prevFilter = { ...buildFilter({ month: prevMonth, district, block }) };
      const prevSchools = await SchoolResponse.find(prevFilter).lean();
      if (prevSchools.length > 0) {
        const prevGeo = classifyGeographyRisk(prevSchools);
        const prevParticipating = prevSchools.filter((s) => s.conducted);
        trend = {
          prevMonth: MONTH_LABELS[prevMonth] || prevMonth,
          completionDelta: geo.participationRate - prevGeo.participationRate,
          attendanceDelta: geo.avgAttendanceRate - prevGeo.avgAttendanceRate,
        };
      }
    }
  }

  // Find the worst sub-geography for the topGap field
  // If no district filter: group by district; if district filter: group by block
  let topGap = null;
  if (!district || district === 'All') {
    const districtGroups = {};
    for (const s of schools) {
      if (!districtGroups[s.district]) districtGroups[s.district] = [];
      districtGroups[s.district].push(s);
    }
    let worstRate = Infinity;
    for (const [name, list] of Object.entries(districtGroups)) {
      const g = classifyGeographyRisk(list);
      if (g.avgAttendanceRate < worstRate) {
        worstRate = g.avgAttendanceRate;
        topGap = name;
      }
    }
  } else if (!block || block === 'All') {
    const blockGroups = {};
    for (const s of schools) {
      if (!blockGroups[s.block]) blockGroups[s.block] = [];
      blockGroups[s.block].push(s);
    }
    let worstRate = Infinity;
    for (const [name, list] of Object.entries(blockGroups)) {
      const g = classifyGeographyRisk(list);
      if (g.avgAttendanceRate < worstRate) {
        worstRate = g.avgAttendanceRate;
        topGap = name;
      }
    }
  }

  const facts = {
    scope: scopeLabel(params),
    totalSchools: geo.totalSchools,
    participatingSchools: geo.participatingSchools,
    participationRate: geo.participationRate,
    evidenceRate,
    attendanceRate: geo.avgAttendanceRate,
    geographyRiskLabel: geo.label,
    riskDistribution: geo.riskDistribution,
    topGap,
    trend,
  };

  return facts;
}

router.post('/generate', async (req, res) => {
  try {
    const params = {
      month: req.body.month || 'All',
      district: req.body.district || 'All',
      block: req.body.block || 'All',
    };

    const facts = await buildProgramFacts(params);
    if (!facts) {
      return res.status(404).json({ error: 'No data found for the given scope.' });
    }

    if (!AI_ENABLED) {
      return res.json({
        facts,
        narrative: null,
        aiEnabled: false,
        message: 'Narrative generation disabled — showing computed facts only.',
      });
    }

    const narrative = generateProgramNarrative(facts);
    res.json({ facts, narrative, aiEnabled: true });
  } catch (err) {
    console.error('Program report error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
