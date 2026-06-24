import mongoose from 'mongoose';

/**
 * SchoolResponse — one document per teacher-school-month row.
 *
 * Key design decisions:
 *  - `grades` and `subjects` are arrays, parsed at seed time from combo-strings
 *    (e.g. "Classes 6, 7 and 8" → ["6","7","8"]) so $in filters work correctly.
 *  - `conducted` and `evidenceSubmitted` are booleans (from "Yes"/"No").
 *  - Derived fields (enrollment, attendance, attendanceRate, riskStatus) are
 *    stored as-is from the CSV — they are ground truth, not recomputed by the app.
 *  - riskStatus is also validated in the seed script against our riskEngine to
 *    confirm zero mismatches.
 */
const schoolResponseSchema = new mongoose.Schema(
  {
    reportingMonth: { type: String, required: true, index: true }, // "2025-07"
    schoolName: { type: String, required: true },
    schoolCode: { type: String, required: true, index: true },
    district: { type: String, required: true, index: true },
    block: { type: String, required: true, index: true },

    conducted: { type: Boolean, required: true }, // Was PBL conducted?
    evidenceSubmitted: { type: Boolean, required: true },

    grades: [{ type: String }], // ["6","7","8"] — parsed from combo-string
    subjects: [{ type: String }], // ["Math","Science"] — parsed from combo-string

    // Raw per-class enrollment and attendance
    enrollClass6: { type: Number, default: 0 },
    attendClass6Science: { type: Number, default: 0 },
    attendClass6Math: { type: Number, default: 0 },
    enrollClass7: { type: Number, default: 0 },
    attendClass7Science: { type: Number, default: 0 },
    attendClass7Math: { type: Number, default: 0 },
    enrollClass8: { type: Number, default: 0 },
    attendClass8Science: { type: Number, default: 0 },
    attendClass8Math: { type: Number, default: 0 },

    // Derived fields — sourced directly from CSV, stored for direct use
    totalEnrollment: { type: Number, default: 0 },
    totalAttendance: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 }, // 0.0–1.0
    riskStatus: {
      type: String,
      enum: ['On Track', 'Behind', 'At Risk', 'Critical'],
      required: true,
    },
  },
  { timestamps: false }
);

// Compound index for the most common filtered query pattern
schoolResponseSchema.index({ reportingMonth: 1, district: 1, block: 1 });
schoolResponseSchema.index({ reportingMonth: 1, grades: 1 });
schoolResponseSchema.index({ reportingMonth: 1, subjects: 1 });

export default mongoose.model('SchoolResponse', schoolResponseSchema);
