import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import {
  getDashboardStats,
  adminGetAllUsers,
  adminUpdateUserStatus,
  adminGetAllDoctors,
  adminGetAllAppointments,
} from "../controllers/admin.controller";

const adminRoute = express.Router();

adminRoute.use(isAuthenticated, authorizeRoles("admin"));

adminRoute.get("/stats", getDashboardStats);
adminRoute.get("/users", adminGetAllUsers);
adminRoute.put("/users/:id/status", adminUpdateUserStatus);
adminRoute.get("/doctors", adminGetAllDoctors);
adminRoute.get("/appointments", adminGetAllAppointments);

export default adminRoute;
