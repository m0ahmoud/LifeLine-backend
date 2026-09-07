import express from "express";
import {
  createClinic,
  updateClinic,
  deleteClinic,
  getClinicById,
} from "../controllers/clinic.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const clinicRoute = express.Router();

// Public routes
clinicRoute.get("/:id", getClinicById);

// Doctor routes
clinicRoute.post(
  "/",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  createClinic,
);

clinicRoute.put(
  "/:id",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  updateClinic,
);

clinicRoute.delete(
  "/:id",
  isAuthenticated,
  authorizeRoles("doctor", "admin"),
  deleteClinic,
);

export default clinicRoute;
