/**
 * riskEngine.test.js
 *
 * Unit tests for the deterministic risk classification engine.
 * Run with: node --test src/tests/riskEngine.test.js
 *
 * Uses Node.js built-in test runner (node:test) — no extra dependencies needed.
 * Each test maps to an explicit threshold boundary from the PRD.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySchoolRisk,
  classifyGeographyRisk,
  RISK_SEVERITY,
} from '../services/riskEngine.js';

// ── classifySchoolRisk ────────────────────────────────────────────────────────

describe('classifySchoolRisk — threshold boundaries', () => {
  it('returns "On Track" for attendance >= 75%', () => {
    assert.equal(classifySchoolRisk(0.76).label, 'On Track');
    assert.equal(classifySchoolRisk(1.00).label, 'On Track');
  });

  it('returns "On Track" at exact 75% boundary', () => {
    assert.equal(classifySchoolRisk(0.75).label, 'On Track');
  });

  it('returns "Behind" for attendance in 60–75% range', () => {
    assert.equal(classifySchoolRisk(0.74).label, 'Behind');
    assert.equal(classifySchoolRisk(0.67).label, 'Behind');
  });

  it('returns "Behind" at exact 60% boundary', () => {
    assert.equal(classifySchoolRisk(0.60).label, 'Behind');
  });

  it('returns "At Risk" for attendance in 35–60% range', () => {
    assert.equal(classifySchoolRisk(0.59).label, 'At Risk');
    assert.equal(classifySchoolRisk(0.50).label, 'At Risk');
  });

  it('returns "At Risk" at exact 35% boundary', () => {
    assert.equal(classifySchoolRisk(0.35).label, 'At Risk');
  });

  it('returns "Critical" for attendance < 35%', () => {
    assert.equal(classifySchoolRisk(0.34).label, 'Critical');
    assert.equal(classifySchoolRisk(0.10).label, 'Critical');
  });

  it('returns "Critical" for non-conducted school (attendance = 0)', () => {
    assert.equal(classifySchoolRisk(0).label, 'Critical');
  });

  it('handles null input gracefully — defaults to 0 → Critical', () => {
    assert.equal(classifySchoolRisk(null).label, 'Critical');
  });

  it('handles undefined input gracefully — defaults to 0 → Critical', () => {
    assert.equal(classifySchoolRisk(undefined).label, 'Critical');
  });

  it('handles string numeric input (from CSV parsing)', () => {
    assert.equal(classifySchoolRisk('0.80').label, 'On Track');
    assert.equal(classifySchoolRisk('0.40').label, 'At Risk');
  });

  it('returns a reason string for every classification', () => {
    const labels = ['On Track', 'Behind', 'At Risk', 'Critical'];
    const rates = [0.80, 0.70, 0.50, 0.10];
    rates.forEach((rate) => {
      const { reason } = classifySchoolRisk(rate);
      assert.ok(typeof reason === 'string' && reason.length > 0,
        `Missing reason for rate ${rate}`);
    });
  });
});

// ── classifyGeographyRisk ─────────────────────────────────────────────────────

describe('classifyGeographyRisk — aggregation logic', () => {
  const makeSchool = (conducted, attendanceRate) => ({ conducted, attendanceRate });

  it('computes correct participation rate', () => {
    const schools = [
      makeSchool(true,  0.80),
      makeSchool(true,  0.70),
      makeSchool(false, 0.00),
      makeSchool(false, 0.00),
    ];
    const result = classifyGeographyRisk(schools);
    assert.equal(result.totalSchools, 4);
    assert.equal(result.participatingSchools, 2);
    assert.equal(result.participationRate, 0.5);
  });

  it('excludes non-participating schools from attendance average', () => {
    const schools = [
      makeSchool(true,  0.80),  // avg = 0.80 (only this one counts)
      makeSchool(false, 0.00),  // excluded from avg
    ];
    const result = classifyGeographyRisk(schools);
    assert.equal(result.avgAttendanceRate, 0.80);
    assert.equal(result.label, 'On Track');
  });

  it('returns Critical when all schools are non-participating', () => {
    const schools = [makeSchool(false, 0.00), makeSchool(false, 0.00)];
    const result = classifyGeographyRisk(schools);
    assert.equal(result.label, 'Critical');
    assert.equal(result.participationRate, 0);
  });

  it('counts non-participants as Critical in risk distribution', () => {
    const schools = [
      makeSchool(true,  0.80), // On Track
      makeSchool(false, 0.00), // Critical (non-participant)
    ];
    const result = classifyGeographyRisk(schools);
    assert.equal(result.riskDistribution.onTrack, 1);
    assert.equal(result.riskDistribution.critical, 1);
  });

  it('handles empty array gracefully', () => {
    const result = classifyGeographyRisk([]);
    assert.equal(result.totalSchools, 0);
    assert.equal(result.participationRate, 0);
    assert.equal(result.avgAttendanceRate, 0);
    assert.equal(result.label, 'Critical');
  });
});

// ── RISK_SEVERITY ordering ────────────────────────────────────────────────────

describe('RISK_SEVERITY — sort order', () => {
  it('Critical sorts before At Risk', () => {
    assert.ok(RISK_SEVERITY['Critical'] < RISK_SEVERITY['At Risk']);
  });

  it('At Risk sorts before Behind', () => {
    assert.ok(RISK_SEVERITY['At Risk'] < RISK_SEVERITY['Behind']);
  });

  it('Behind sorts before On Track', () => {
    assert.ok(RISK_SEVERITY['Behind'] < RISK_SEVERITY['On Track']);
  });

  it('rows sort worst-first using RISK_SEVERITY', () => {
    const rows = [
      { label: 'On Track' },
      { label: 'Critical' },
      { label: 'Behind' },
      { label: 'At Risk' },
    ];
    rows.sort((a, b) => RISK_SEVERITY[a.label] - RISK_SEVERITY[b.label]);
    assert.equal(rows[0].label, 'Critical');
    assert.equal(rows[1].label, 'At Risk');
    assert.equal(rows[2].label, 'Behind');
    assert.equal(rows[3].label, 'On Track');
  });
});
