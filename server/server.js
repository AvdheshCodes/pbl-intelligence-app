import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import dashboardRouter from './src/routes/dashboard.js';
import geographiesRouter from './src/routes/geographies.js';
import grantsRouter from './src/routes/grants.js';
import programReportRouter from './src/routes/programReport.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static images from data/raw/images
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/images', express.static(path.join(__dirname, 'data', 'raw', 'images')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRouter);
app.use('/api/geographies', geographiesRouter);
app.use('/api/grants', grantsRouter);
app.use('/api/program-report', programReportRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiEnabled: process.env.AI_ENABLED !== 'false' }));

// ── DB + Start ────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
