import express from "express";
import {
  createMedicalRecord,
  getPatientMedicalHistory,
  getAppointmentMedicalRecord,
} from "../controllers/medicalRecord.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";

const medicalRecordRoute = express.Router();

// Doctor routes
medicalRecordRoute.post(
  "/",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  createMedicalRecord,
);

// Patient routes
medicalRecordRoute.get(
  "/patient",
  isAuthenticated,
  authorizeRoles("user", "admin"),
  getPatientMedicalHistory,
);

// Shared route (Patient, Doctor, Admin)
medicalRecordRoute.get(
  "/appointment/:appointmentId",
  isAuthenticated,
  authorizeRoles("user", "doctor", "admin"),
  getAppointmentMedicalRecord,
);

export default medicalRecordRoute;
