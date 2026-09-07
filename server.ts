import { v2 as cloudinary } from "cloudinary";
import { app } from "./app";
import connectDB from "./utils/db";
import { iniSocketServer } from "./socketServer";
import { initCronJobs } from "./cron/reminders";
const http = require("http");
require("dotenv").config();

const server = http.createServer(app);

// ── Cloudinary config ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY,
});

iniSocketServer(server);

// ── Start server ───────────────────────────────────────────────────────────
const PORT = 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  connectDB();
  initCronJobs();
});
