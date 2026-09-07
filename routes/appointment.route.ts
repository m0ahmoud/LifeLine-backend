import express from "express";
import {
  bookAppointment,
  updateAppointmentStatus,
  getMyPatientAppointments,
  getDoctorAppointments,
  getAppointmentById,
} from "../controllers/appointment.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const appointmentRoute = express.Router();

// Patient routes
appointmentRoute.post(
  "/",
  isAuthenticated,
  authorizeRoles("user", "admin"),
  bookAppointment,
); // POST   /api/v1/appointments

appointmentRoute.get(
  "/my",
  isAuthenticated,
  authorizeRoles("user", "admin"),
  getMyPatientAppointments,
); // GET    /api/v1/appointments/my

// Doctor routes
appointmentRoute.get(
  "/doctor",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  getDoctorAppointments,
); // GET    /api/v1/appointments/doctor

// Shared
appointmentRoute.get("/:id", isAuthenticated, getAppointmentById); // GET    /api/v1/appointments/:id

appointmentRoute.patch("/:id/status", isAuthenticated, updateAppointmentStatus); // PATCH  /api/v1/appointments/:id/status

export default appointmentRoute;
