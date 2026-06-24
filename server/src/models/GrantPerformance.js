import mongoose from 'mongoose';

/**
 * GrantPerformance — one document per grant × month.
 * Source: 02_Grant_Performance_and_Report_Material.csv
 *
 * IMPORTANT: The `draft_report_text` column from the source CSV is
 * deliberately NOT stored here. It is a human-written style reference only —
 * displaying it would misrepresent it as app-generated output.
 * The app's narrativeGenerator.js produces independent text grounded in the
 * numeric fields below.
 */
const grantPerformanceSchema = new mongoose.Schema(
  {
    grantId: { type: String, required: true, index: true },
    donor: { type: String, required: true },
    grantName: { type: String, required: true },
    reportingMonth: { type: String, required: true, index: true },
    periodEndDate: { type: String },
    reportDueDate: { type: String },
    reportStatus: { type: String },
    coveredDistricts: [{ type: String }], // parsed from semicolon-separated
    sampledSchoolRecords: { type: Number, default: 0 },
    schoolsCompletedPbl: { type: Number, default: 0 },
    pblCompletionRate: { type: Number, default: 0 }, // 0.0–1.0
    schoolsWithEvidence: { type: Number, default: 0 },
    evidenceSubmissionRate: { type: Number, default: 0 }, // 0.0–1.0
    totalEnrollment: { type: Number, default: 0 },
    totalAttendance: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 }, // 0.0–1.0
    riskStatus: {
      type: String,
      enum: ['On Track', 'Behind', 'At Risk', 'Critical'],
      required: true,
    },
    milestoneSummary: { type: String, default: '' },
    // draft_report_text intentionally excluded
  },
  { timestamps: false }
);

grantPerformanceSchema.index({ grantId: 1, reportingMonth: 1 });

export default mongoose.model('GrantPerformance', grantPerformanceSchema);
