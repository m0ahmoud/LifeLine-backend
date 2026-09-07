import express from "express";
import {
  createDoctorProfile,
  updateDoctorProfile,
  getMyDoctorProfile,
  getDoctorProfile,
  getAllDoctors,
  verifyDoctor,
  revokeDoctor,
} from "../controllers/doctor.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const doctorRoute = express.Router();

// Public routes
doctorRoute.get("/", getAllDoctors);

// Doctor routes
doctorRoute.post(
  "/",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  createDoctorProfile,
);

doctorRoute.put(
  "/",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  updateDoctorProfile,
);

doctorRoute.get(
  "/me",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  getMyDoctorProfile,
);

doctorRoute.get("/:id", getDoctorProfile);

// Admin routes
doctorRoute.put(
  "/verify/:id",
  isAuthenticated,
  authorizeRoles("admin", "doctor"),
  verifyDoctor,
);

doctorRoute.put(
  "/revoke/:id",
  isAuthenticated,
  authorizeRoles("admin", "doctor"),
  revokeDoctor,
);

export default doctorRoute;
