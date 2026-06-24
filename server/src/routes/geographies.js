/**
 * routes/geographies.js
 * GET /api/geographies?month=&district=&block=&grade=&subject=
 *
 * Returns per-district (or per-block when district is filtered) performance
 * rows for the sortable table view. Default sort: worst-performing first
 * (lowest participation rate).
 */

import express from 'express';
import SchoolResponse from '../models/SchoolResponse.js';
import { classifyGeographyRisk, RISK_SEVERITY } from '../services/riskEngine.js';

const router = express.Router();

function buildFilter(query) {
  const filter = {};
  if (query.month && query.month !== 'All') filter.reportingMonth = query.month;
  if (query.district && query.district !== 'All') filter.district = query.district;
  if (query.block && query.block !== 'All') filter.block = query.block;
  if (query.grade && query.grade !== 'All') {
    const arr = query.grade.split(',').map((g) => g.trim()).filter(Boolean);
    if (arr.length) filter.grades = { $in: arr };
  }
  if (query.subject && query.subject !== 'All') {
    const arr = query.subject.split(',').map((s) => s.trim()).filter(Boolean);
    if (arr.length) filter.subjects = { $in: arr };
  }
  return filter;
}

router.get('/', async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const schools = await SchoolResponse.find(filter).lean();

    // Determine grouping level: if a district is filtered, group by block; else group by district
    const groupKey = req.query.district && req.query.district !== 'All' ? 'block' : 'district';

    // Group school rows by district or block
    const groups = {};
    for (const s of schools) {
      const key = s[groupKey];
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }

    const rows = Object.entries(groups).map(([name, schoolList]) => {
      const risk = classifyGeographyRisk(schoolList);
      const evidenceAmongParticipants = schoolList.filter((s) => s.conducted && s.evidenceSubmitted).length;
      const participatingCount = schoolList.filter((s) => s.conducted).length;
      const evidenceRate = participatingCount > 0 ? evidenceAmongParticipants / participatingCount : 0;

      return {
        name,
        groupKey,
        totalSchools: risk.totalSchools,
        participatingSchools: risk.participatingSchools,
        participationRate: risk.participationRate,
        evidenceRate,
        avgAttendanceRate: risk.avgAttendanceRate,
        riskLabel: risk.label,
        riskReason: risk.reason,
        riskDistribution: risk.riskDistribution,
      };
    });

    // Default sort: worst first (lowest participation rate, then lowest attendance)
    rows.sort((a, b) => {
      const severityDiff = (RISK_SEVERITY[a.riskLabel] ?? 4) - (RISK_SEVERITY[b.riskLabel] ?? 4);
      if (severityDiff !== 0) return severityDiff;
      return a.participationRate - b.participationRate;
    });

    res.json({ rows, groupKey, total: rows.length });
  } catch (err) {
    console.error('Geographies error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
