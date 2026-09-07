import express from "express";
import { sendContactMessage } from "../controllers/contact.controller";
import { rateLimit } from "express-rate-limit";

const contactRoute = express.Router();

// Strict rate limit for contact form — prevent spam
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  message: { success: false, message: "Too many contact requests, please try again later." },
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

contactRoute.post("/contact", contactLimiter, sendContactMessage);

export default contactRoute;
