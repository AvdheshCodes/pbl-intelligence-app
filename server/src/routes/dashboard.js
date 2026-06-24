/**
 * routes/dashboard.js
 * GET /api/dashboard?month=&district=&block=&grade=&subject=
 *
 * Returns KPI cards + trend deltas + risk distribution for the filtered set.
 *
 * Aggregation strategy: MongoDB aggregation pipeline with compound index on
 * (reportingMonth, district, block). Given ~6,900 total rows, a full-scan per
 * request is acceptable; the index makes filtered scans fast. A materialized
 * cache would be the next optimization step (noted in README).
 *
 * Two distinct signals (per PRD requirement):
 *  1. participationRate — % of all schools that ran a PBL session
 *  2. attendanceRate — avg attendance rate ONLY among schools that ran sessions
 * These must never be collapsed into one number.
 */

import express from 'express';
import SchoolResponse from '../models/SchoolResponse.js';
import { classifySchoolRisk } from '../services/riskEngine.js';

const router = express.Router();

// Build a MongoDB filter object from query params
function buildFilter(query) {
  const filter = {};

  if (query.month && query.month !== 'All') {
    filter.reportingMonth = query.month;
  }
  if (query.district && query.district !== 'All') {
    filter.district = query.district;
  }
  if (query.block && query.block !== 'All') {
    filter.block = query.block;
  }
  // Grade: comma-separated, e.g. "6,7" → filter rows where grades array contains any
  if (query.grade && query.grade !== 'All') {
    const gradeArr = query.grade.split(',').map((g) => g.trim()).filter(Boolean);
    if (gradeArr.length > 0) filter.grades = { $in: gradeArr };
  }
  // Subject: comma-separated
  if (query.subject && query.subject !== 'All') {
    const subjArr = query.subject.split(',').map((s) => s.trim()).filter(Boolean);
    if (subjArr.length > 0) filter.subjects = { $in: subjArr };
  }

  return filter;
}

// Compute KPIs from an array of school documents
function computeKPIs(schools) {
  const total = schools.length;
  const participating = schools.filter((s) => s.conducted);
  const participatingCount = participating.length;
  const participationRate = total > 0 ? participatingCount / total : 0;

  // Evidence rate: only among schools that conducted PBL
  const evidenceCount = participating.filter((s) => s.evidenceSubmitted).length;
  const evidenceRate = participatingCount > 0 ? evidenceCount / participatingCount : 0;

  // Enrollment and attendance — all rows (enrollment is real even for non-conducted)
  const totalEnrollment = schools.reduce((s, r) => s + (r.totalEnrollment || 0), 0);
  // Attendance sum across ALL rows (non-conducted = 0)
  const totalAttendanceAll = schools.reduce((s, r) => s + (r.totalAttendance || 0), 0);

  // Attendance rate among PARTICIPATING schools only (key signal #2).
  // IMPORTANT: We average the pre-computed per-school attendanceRate, not
  // (sumAttendance / sumEnrollment). The CSV's attendanceRate already correctly
  // handles the double-counting issue (attendance includes both Math + Science
  // sessions, which can sum to > enrollment). Using raw totals would give a
  // rate > 1.0. The per-school rate is the ground-truth rate from the CSV.
  const participantEnrollment = participating.reduce((s, r) => s + (r.totalEnrollment || 0), 0);
  const participantAttendance = participating.reduce((s, r) => s + (r.totalAttendance || 0), 0);
  const attendanceRateAmongParticipants =
    participating.length > 0
      ? participating.reduce((s, r) => s + (r.attendanceRate || 0), 0) / participating.length
      : 0;

  // Risk distribution across ALL schools (non-participants are Critical by formula)
  const riskDistribution = { onTrack: 0, behind: 0, atRisk: 0, critical: 0 };
  for (const s of schools) {
    const { label } = classifySchoolRisk(s.attendanceRate);
    if (label === 'On Track') riskDistribution.onTrack++;
    else if (label === 'Behind') riskDistribution.behind++;
    else if (label === 'At Risk') riskDistribution.atRisk++;
    else riskDistribution.critical++;
  }

  return {
    totalSchools: total,
    participatingSchools: participatingCount,
    participationRate,
    evidenceSubmissions: evidenceCount,
    evidenceRate,
    totalEnrollment,
    totalAttendance: totalAttendanceAll,
    participantEnrollment,
    participantAttendance,
    attendanceRateAmongParticipants,
    riskDistribution,
  };
}

router.get('/', async (req, res) => {
  try {
    const filter = buildFilter(req.query);
    const schools = await SchoolResponse.find(filter).lean();
    const kpis = computeKPIs(schools);

    // ── Month-over-month trend ────────────────────────────────────────────────
    // When a specific month is selected: compare with the adjacent prior month.
    // When All months: return trend data for all 3 months in order.
    const MONTHS = ['2025-07', '2025-08', '2025-09'];
    let trend = null;

    if (req.query.month && req.query.month !== 'All') {
      const currentIdx = MONTHS.indexOf(req.query.month);
      if (currentIdx > 0) {
        const prevMonth = MONTHS[currentIdx - 1];
        const prevFilter = { ...filter, reportingMonth: prevMonth };
        const prevSchools = await SchoolResponse.find(prevFilter).lean();
        const prevKpis = computeKPIs(prevSchools);
        trend = {
          prevMonth,
          participationDelta: kpis.participationRate - prevKpis.participationRate,
          attendanceDelta: kpis.attendanceRateAmongParticipants - prevKpis.attendanceRateAmongParticipants,
          prevParticipationRate: prevKpis.participationRate,
          prevAttendanceRate: prevKpis.attendanceRateAmongParticipants,
        };
      }
    } else {
      // All months — build a 3-point trend series
      const baseFilter = { ...filter };
      delete baseFilter.reportingMonth;
      const series = await Promise.all(
        MONTHS.map(async (m) => {
          const mSchools = await SchoolResponse.find({ ...baseFilter, reportingMonth: m }).lean();
          const mKpis = computeKPIs(mSchools);
          return {
            month: m,
            participationRate: mKpis.participationRate,
            attendanceRate: mKpis.attendanceRateAmongParticipants,
            totalSchools: mKpis.totalSchools,
          };
        })
      );
      trend = { type: 'series', data: series };
    }

    res.json({ kpis, trend, filterApplied: filter });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/filters — return distinct values for dropdowns
router.get('/filters', async (req, res) => {
  try {
    const [months, districts, blocks] = await Promise.all([
      SchoolResponse.distinct('reportingMonth'),
      SchoolResponse.distinct('district'),
      SchoolResponse.distinct('block'),
    ]);

    // Dependent blocks by district (if district query param provided)
    let filteredBlocks = blocks;
    if (req.query.district && req.query.district !== 'All') {
      filteredBlocks = await SchoolResponse.distinct('block', { district: req.query.district });
    }

    res.json({
      months: months.sort(),
      districts: districts.sort(),
      blocks: filteredBlocks.sort(),
      grades: ['6', '7', '8'],
      subjects: ['Math', 'Science'],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
