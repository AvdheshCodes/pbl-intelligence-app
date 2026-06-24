/**
 * routes/grants.js
 *
 * GET  /api/grants                          — list all grants
 * GET  /api/grants/:grantId/report?month=   — fact panel data
 * POST /api/grants/:grantId/report/generate?month= — narrative generation
 *
 * AI_ENABLED env flag:
 *  - When "false" (string comparison): generate endpoint returns
 *    { narrative: null, aiEnabled: false } alongside the full facts object.
 *  - When true: narrative is generated and returned.
 */

import express from 'express';
import GrantFinance from '../models/GrantFinance.js';
import GrantPerformance from '../models/GrantPerformance.js';
import EvidenceRecord from '../models/EvidenceRecord.js';
import { generateGrantNarrative } from '../services/narrativeGenerator.js';

const router = express.Router();

const AI_ENABLED = process.env.AI_ENABLED !== 'false';

// ── Build grant facts object from DB documents ────────────────────────────────

async function buildGrantFacts(grantId, month) {
  const [perf, financeLines, evidence, allPerf] = await Promise.all([
    GrantPerformance.findOne({ grantId, reportingMonth: month }).lean(),
    GrantFinance.find({ grantId, reportingMonth: month }).lean(),
    EvidenceRecord.find({ grantId, reportingMonth: month }).lean(),
    // For trend: fetch all months for this grant, sorted
    GrantPerformance.find({ grantId }).sort({ reportingMonth: 1 }).lean(),
  ]);

  if (!perf) return null;

  // Compute trend vs. prior month
  const MONTHS = ['2025-07', '2025-08', '2025-09'];
  const currentIdx = MONTHS.indexOf(month);
  let trend = null;
  if (currentIdx > 0) {
    const prevMonth = MONTHS[currentIdx - 1];
    const prevPerf = allPerf.find((p) => p.reportingMonth === prevMonth);
    if (prevPerf) {
      trend = {
        prevMonth,
        completionDelta: perf.pblCompletionRate - prevPerf.pblCompletionRate,
        attendanceDelta: perf.attendanceRate - prevPerf.attendanceRate,
      };
    }
  }

  return {
    grantId: perf.grantId,
    grantName: perf.grantName,
    donor: perf.donor,
    reportingMonth: perf.reportingMonth,
    reportStatus: perf.reportStatus,
    reportDueDate: perf.reportDueDate,
    coveredDistricts: perf.coveredDistricts,
    sampledSchoolRecords: perf.sampledSchoolRecords,
    schoolsCompletedPbl: perf.schoolsCompletedPbl,
    pblCompletionRate: perf.pblCompletionRate,
    schoolsWithEvidence: perf.schoolsWithEvidence,
    evidenceSubmissionRate: perf.evidenceSubmissionRate,
    totalEnrollment: perf.totalEnrollment,
    totalAttendance: perf.totalAttendance,
    attendanceRate: perf.attendanceRate,
    riskStatus: perf.riskStatus,
    milestoneSummary: perf.milestoneSummary,
    financeLines: financeLines.map((f) => ({
      budgetLine: f.budgetLine,
      approvedBudgetUnits: f.approvedBudgetUnits,
      monthlyUtilizedUnits: f.monthlyUtilizedUnits,
      cumulativeUtilizedUnits: f.cumulativeUtilizedUnits,
      cumulativeUtilizationRate: f.cumulativeUtilizationRate,
      financeNote: f.financeNote,
    })),
    evidenceRefs: evidence.map((e) => ({
      recordId: e.recordId,
      recordType: e.recordType,
      title: e.title,
      summaryOrCaption: e.summaryOrCaption,
      relativePath: e.relativePath,
      district: e.district,
      usageNote: e.usageNote,
    })),
    trend,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/grants — list all distinct grants
router.get('/', async (_req, res) => {
  try {
    const grants = await GrantPerformance.aggregate([
      { $group: { _id: '$grantId', grantName: { $first: '$grantName' }, donor: { $first: '$donor' }, months: { $addToSet: '$reportingMonth' } } },
      { $project: { grantId: '$_id', grantName: 1, donor: 1, months: 1, _id: 0 } },
      { $sort: { grantId: 1 } },
    ]);
    res.json({ grants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grants/:grantId/report?month= — fact panel
router.get('/:grantId/report', async (req, res) => {
  try {
    const { grantId } = req.params;
    const { month } = req.query;

    if (!month) return res.status(400).json({ error: 'month query param required' });

    const facts = await buildGrantFacts(grantId, month);
    if (!facts) return res.status(404).json({ error: `No performance data for ${grantId} / ${month}` });

    res.json({ facts, aiEnabled: AI_ENABLED });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grants/:grantId/report/generate?month= — narrative generation
router.post('/:grantId/report/generate', async (req, res) => {
  try {
    const { grantId } = req.params;
    const { month } = req.query;

    if (!month) return res.status(400).json({ error: 'month query param required' });

    const facts = await buildGrantFacts(grantId, month);
    if (!facts) return res.status(404).json({ error: `No performance data for ${grantId} / ${month}` });

    if (!AI_ENABLED) {
      return res.json({
        facts,
        narrative: null,
        aiEnabled: false,
        message: 'Narrative generation disabled — showing computed facts only.',
      });
    }

    // narrative generator receives ONLY the facts object — no raw rows, no DB calls
    const narrative = generateGrantNarrative(facts);

    res.json({ facts, narrative, aiEnabled: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
