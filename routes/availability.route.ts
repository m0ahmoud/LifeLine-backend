import express from "express";
import {
  setAvailability,
  getAvailability,
  getAvailableSlots,
} from "../controllers/availability.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const availabilityRoute = express.Router();

// Public
availabilityRoute.get("/slots", getAvailableSlots);                      // GET /api/v1/availability/slots?clinicId=xxx&date=2026-09-10
availabilityRoute.get("/:clinicId", getAvailability);                    // GET /api/v1/availability/:clinicId

// Doctor / Admin
availabilityRoute.post(
  "/",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  setAvailability,
);

export default availabilityRoute;
