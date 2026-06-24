import mongoose from 'mongoose';

/**
 * GrantFinance — one document per grant × month × budget line.
 * Source: 01_Grant_Profile_and_Finance.csv
 */
const grantFinanceSchema = new mongoose.Schema(
  {
    grantId: { type: String, required: true, index: true }, // "GRANT_AA_2025"
    donor: { type: String, required: true },
    grantName: { type: String, required: true },
    periodStart: { type: String }, // "2025-07-01"
    periodEnd: { type: String }, // "2025-09-30"
    coveredDistricts: [{ type: String }], // parsed from semicolon-separated string
    reportingMonth: { type: String, required: true, index: true }, // "2025-07"
    budgetLine: { type: String, required: true },
    approvedBudgetUnits: { type: Number, default: 0 },
    monthlyUtilizedUnits: { type: Number, default: 0 },
    cumulativeUtilizedUnits: { type: Number, default: 0 },
    cumulativeUtilizationRate: { type: Number, default: 0 }, // 0.0–1.0
    financeNote: { type: String, default: '' },
  },
  { timestamps: false }
);

grantFinanceSchema.index({ grantId: 1, reportingMonth: 1 });

export default mongoose.model('GrantFinance', grantFinanceSchema);
