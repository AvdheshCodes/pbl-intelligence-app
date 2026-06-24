import mongoose from 'mongoose';

/**
 * EvidenceRecord — one document per media asset.
 * Source: 03_Evidence_and_Media_Index.csv
 *
 * `relativePath` is used by the frontend to build the image URL:
 *   `${API_BASE_URL}/${relativePath}`
 * The server serves `/images/` as a static directory from `data/raw/images/`.
 */
const evidenceRecordSchema = new mongoose.Schema(
  {
    recordId: { type: String, required: true, unique: true }, // "MEDIA_AA_01"
    recordType: { type: String, required: true }, // "image" | "news_clipping"
    grantId: { type: String, required: true, index: true },
    donor: { type: String },
    reportingMonth: { type: String, required: true, index: true },
    district: { type: String },
    title: { type: String },
    summaryOrCaption: { type: String },
    fileName: { type: String },
    relativePath: { type: String }, // "images/student_project_activity_photo_01.png"
    usageNote: { type: String },
  },
  { timestamps: false }
);

evidenceRecordSchema.index({ grantId: 1, reportingMonth: 1 });

export default mongoose.model('EvidenceRecord', evidenceRecordSchema);
