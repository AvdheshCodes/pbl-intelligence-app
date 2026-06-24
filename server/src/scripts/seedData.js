/**
 * seedData.js — CSV → MongoDB ingestion script.
 *
 * Run with: npm run seed (from server/)
 *
 * What this does:
 *  1. Reads all 3 PBL school response CSVs (July, August, September)
 *  2. Reads all 3 grant CSVs (finance, performance, evidence)
 *  3. Parses grade/subject combo-strings into arrays
 *  4. Cross-checks riskEngine output against CSV's "Derived: Risk status" column
 *  5. Clears all 4 collections, then bulk-inserts
 *
 * Parsing details:
 *  - Grades: "Classes 6, 7 and 8" → ["6","7","8"] via digit extraction
 *  - Subjects: "Math and Science" → ["Math","Science"] via known-word matching
 *  - Districts: "District T; District G" → ["District T","District G"]
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';

import SchoolResponse from '../models/SchoolResponse.js';
import GrantFinance from '../models/GrantFinance.js';
import GrantPerformance from '../models/GrantPerformance.js';
import EvidenceRecord from '../models/EvidenceRecord.js';
import { classifySchoolRisk } from '../services/riskEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', '..', 'data', 'raw');

// ── Parsing helpers ───────────────────────────────────────────────────────────

/**
 * Parse grade combo-strings into an array of digit strings.
 * "Classes 6, 7 and 8" → ["6","7","8"]
 * "Class 6" → ["6"]
 * "" (non-conducted rows) → []
 */
function parseGrades(raw) {
  if (!raw || raw.trim() === '') return [];
  const digits = raw.match(/\d+/g);
  return digits ? digits : [];
}

/**
 * Parse subject combo-strings into an array of known subject names.
 * "Math and Science" → ["Math","Science"]
 * "Math" → ["Math"]
 * Matching is case-insensitive against known subject list.
 */
const KNOWN_SUBJECTS = ['Math', 'Science'];
function parseSubjects(raw) {
  if (!raw || raw.trim() === '') return [];
  return KNOWN_SUBJECTS.filter((s) => raw.toLowerCase().includes(s.toLowerCase()));
}

/**
 * Parse semicolon-separated district strings.
 * "District T; District G; District AK" → ["District T","District G","District AK"]
 */
function parseDistricts(raw) {
  if (!raw || raw.trim() === '') return [];
  return raw.split(';').map((d) => d.trim()).filter(Boolean);
}

function safeInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function safeFloat(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true });
}

// ── School Response ingestion ─────────────────────────────────────────────────

const PBL_FILES = [
  { month: '2025-07', file: 'PBL_School_Response_Data_July_2025.csv' },
  { month: '2025-08', file: 'PBL_School_Response_Data_August_2025.csv' },
  { month: '2025-09', file: 'PBL_School_Response_Data_September_2025.csv' },
];

function transformSchoolRow(row) {
  const conducted = row['Was the PBL project conducted in your school this month?'] === 'Yes';
  const evidenceSubmitted = row['Was evidence submitted for the completed PBL project?'] === 'Yes';
  const attendanceRate = safeFloat(row['Derived: Overall PBL attendance rate']);
  const csvRiskStatus = row['Derived: Risk status'];

  // Cross-check: our engine must agree with the CSV-derived risk label
  const { label: engineRisk } = classifySchoolRisk(attendanceRate);
  if (engineRisk !== csvRiskStatus) {
    console.warn(
      `⚠️  Risk mismatch for ${row["What is your school's synthetic school code?"]} ` +
        `(${row['Reporting Month']}): engine="${engineRisk}" csv="${csvRiskStatus}" rate=${attendanceRate}`
    );
  }

  return {
    reportingMonth: row['Reporting Month'],
    schoolName: row['What is the name of your school?'],
    schoolCode: row["What is your school's synthetic school code?"],
    district: row['What is the name of your district?'],
    block: row['Block Details'],
    conducted,
    evidenceSubmitted,
    grades: parseGrades(row['In which class/classes did you conduct the PBL project?']),
    subjects: parseSubjects(row['Which subject do you teach?']),
    enrollClass6: safeInt(row['Total number of students enrolled in Class 6, including all sections']),
    attendClass6Science: safeInt(row['Average student attendance during the Class 6 PBL Science session. If you did not teach Science in Class 6, enter 0.']),
    attendClass6Math: safeInt(row['Average student attendance during the Class 6 PBL Math session. If you did not teach Math in Class 6, enter 0.']),
    enrollClass7: safeInt(row['Total number of students enrolled in Class 7, including all sections']),
    attendClass7Science: safeInt(row['Average student attendance during the Class 7 PBL Science session. If you did not teach Science in Class 7, enter 0.']),
    attendClass7Math: safeInt(row['Average student attendance during the Class 7 PBL Math session. If you did not teach Math in Class 7, enter 0.']),
    enrollClass8: safeInt(row['Total number of students enrolled in Class 8, including all sections']),
    attendClass8Science: safeInt(row['Average student attendance during the Class 8 PBL Science session. If you did not teach Science in Class 8, enter 0.']),
    attendClass8Math: safeInt(row['Average student attendance during the Class 8 PBL Math session. If you did not teach Math in Class 8, enter 0.']),
    totalEnrollment: safeInt(row['Derived: Total enrollment across Classes 6-8']),
    totalAttendance: safeInt(row['Derived: Total attendance across PBL Science and Math sessions']),
    attendanceRate,
    riskStatus: csvRiskStatus, // use CSV ground truth; engine cross-check logged above
  };
}

// ── Grant Finance ingestion ───────────────────────────────────────────────────

function transformFinanceRow(row) {
  return {
    grantId: row['grant_id'],
    donor: row['donor'],
    grantName: row['grant_name'],
    periodStart: row['period_start'],
    periodEnd: row['period_end'],
    coveredDistricts: parseDistricts(row['covered_districts']),
    reportingMonth: row['reporting_month'],
    budgetLine: row['budget_line'],
    approvedBudgetUnits: safeInt(row['approved_budget_units']),
    monthlyUtilizedUnits: safeInt(row['monthly_utilized_units']),
    cumulativeUtilizedUnits: safeInt(row['cumulative_utilized_units']),
    cumulativeUtilizationRate: safeFloat(row['cumulative_utilization_rate']),
    financeNote: row['finance_note'] || '',
  };
}

// ── Grant Performance ingestion ───────────────────────────────────────────────

function transformPerformanceRow(row) {
  // draft_report_text is intentionally excluded — see GrantPerformance model comment
  return {
    grantId: row['grant_id'],
    donor: row['donor'],
    grantName: row['grant_name'],
    reportingMonth: row['reporting_month'],
    periodEndDate: row['period_end_date'],
    reportDueDate: row['report_due_date'],
    reportStatus: row['report_status'],
    coveredDistricts: parseDistricts(row['covered_districts']),
    sampledSchoolRecords: safeInt(row['sampled_school_records']),
    schoolsCompletedPbl: safeInt(row['schools_completed_pbl']),
    pblCompletionRate: safeFloat(row['pbl_completion_rate']),
    schoolsWithEvidence: safeInt(row['schools_with_evidence']),
    evidenceSubmissionRate: safeFloat(row['evidence_submission_rate']),
    totalEnrollment: safeInt(row['total_enrollment']),
    totalAttendance: safeInt(row['total_attendance']),
    attendanceRate: safeFloat(row['attendance_rate']),
    riskStatus: row['risk_status'],
    milestoneSummary: row['milestone_summary'] || '',
  };
}

// ── Evidence Record ingestion ─────────────────────────────────────────────────

function transformEvidenceRow(row) {
  return {
    recordId: row['record_id'],
    recordType: row['record_type'],
    grantId: row['grant_id'],
    donor: row['donor'],
    reportingMonth: row['reporting_month'],
    district: row['district'],
    title: row['title'],
    summaryOrCaption: row['summary_or_caption'],
    fileName: row['file_name'],
    relativePath: row['relative_path'],
    usageNote: row['usage_note'],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ── School Responses ──
    console.log('\n📊 Seeding school responses...');
    await SchoolResponse.deleteMany({});
    let totalSchoolRows = 0;
    let totalMismatches = 0;

    for (const { file } of PBL_FILES) {
      const filePath = path.join(RAW_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Missing file: ${filePath}`);
        process.exit(1);
      }
      const rows = readCsv(filePath);
      const docs = rows.map(transformSchoolRow);

      // Count mismatches from cross-check (already logged per-row above)
      const mismatches = docs.filter((d, i) => {
        const { label } = classifySchoolRisk(d.attendanceRate);
        return label !== d.riskStatus;
      }).length;
      totalMismatches += mismatches;

      await SchoolResponse.insertMany(docs, { ordered: false });
      console.log(`  ✅ ${file}: ${docs.length} rows inserted`);
      totalSchoolRows += docs.length;
    }

    console.log(`  📌 Total school rows: ${totalSchoolRows}`);
    if (totalMismatches > 0) {
      console.warn(`  ⚠️  Risk mismatches: ${totalMismatches} (see warnings above)`);
    } else {
      console.log(`  ✅ Risk engine cross-check: 0 mismatches`);
    }

    // ── Grant Finance ──
    console.log('\n💰 Seeding grant finance...');
    await GrantFinance.deleteMany({});
    const financeRows = readCsv(path.join(RAW_DIR, '01_Grant_Profile_and_Finance.csv'));
    const financeDocs = financeRows.map(transformFinanceRow);
    await GrantFinance.insertMany(financeDocs);
    console.log(`  ✅ ${financeDocs.length} finance rows inserted`);

    // ── Grant Performance ──
    console.log('\n📈 Seeding grant performance...');
    await GrantPerformance.deleteMany({});
    const perfRows = readCsv(path.join(RAW_DIR, '02_Grant_Performance_and_Report_Material.csv'));
    const perfDocs = perfRows.map(transformPerformanceRow);
    await GrantPerformance.insertMany(perfDocs);
    console.log(`  ✅ ${perfDocs.length} performance rows inserted`);

    // ── Evidence Records ──
    console.log('\n🖼️  Seeding evidence records...');
    await EvidenceRecord.deleteMany({});
    const evidenceRows = readCsv(path.join(RAW_DIR, '03_Evidence_and_Media_Index.csv'));
    const evidenceDocs = evidenceRows.map(transformEvidenceRow);
    await EvidenceRecord.insertMany(evidenceDocs);
    console.log(`  ✅ ${evidenceDocs.length} evidence records inserted`);

    console.log('\n🎉 Seed complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
