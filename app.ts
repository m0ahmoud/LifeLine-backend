require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import logger from "./utils/logger";
import { ErrorMiddleware } from "./middleware/error";
import userRoute from "./routes/user.route";
import doctorRoute from "./routes/doctor.route";
import clinicRoute from "./routes/clinic.route";
import availabilityRoute from "./routes/availability.route";
import appointmentRoute from "./routes/appointment.route";
import medicalRecordRoute from "./routes/medicalRecord.route";
import notificationRoute from "./routes/notification.route";
import reviewRoute from "./routes/review.route";
import paymentRoute from "./routes/payment.route";
import adminRoute from "./routes/admin.route";
import contactRoute from "./routes/contact.route";

export const app = express();
app.set("trust proxy", 1);

// ── Security Headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── Request Logging ────────────────────────────────────────────────────────
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

// ── Body & Cookie parser ───────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// ── CORS ───────────────────────────────────────────────────────────────────
let allowedOrigins = [
  "http://localhost:3000",
  "https://front-life-line.vercel.app",
];
if (process.env.ORIGIN) {
  try {
    if (process.env.ORIGIN.startsWith("[")) {
      allowedOrigins = JSON.parse(process.env.ORIGIN);
    } else {
      allowedOrigins = process.env.ORIGIN.split(",").map((o) => o.trim());
    }
  } catch {
    allowedOrigins = [process.env.ORIGIN];
  }
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Rate Limiter ───────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  ipv6Subnet: 56,
});
app.use(limiter);

// ── Health check (instant response for container health probes) ───────────
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Healthy" });
});
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Healthy" });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/v1", userRoute);
app.use("/api/v1/doctors", doctorRoute);
app.use("/api/v1/clinics", clinicRoute);
app.use("/api/v1/availability", availabilityRoute);
app.use("/api/v1/appointments", appointmentRoute);
app.use("/api/v1/medical-records", medicalRecordRoute);
app.use("/api/v1/notifications", notificationRoute);
app.use("/api/v1/reviews", reviewRoute);
app.use("/api/v1/payments", paymentRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1", contactRoute);

// ── Test route ─────────────────────────────────────────────────────────────
app.get("/test", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "hello world" });
});

// ── 404 ────────────────────────────────────────────────────────────────────
app.use("*", (req: Request, _res: Response, next: NextFunction) => {
  const err = new Error(`Route ${req.originalUrl} not found`) as any;
  err.statusCode = 404;
  next(err);
});

// ── Global error handler ───────────────────────────────────────────────────
app.use(ErrorMiddleware);
