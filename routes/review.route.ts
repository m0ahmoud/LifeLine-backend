import express from "express";
import {
  createReview,
  getDoctorReviews,
} from "../controllers/review.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const reviewRoute = express.Router();

// Patients can post reviews
reviewRoute.post("/", isAuthenticated, authorizeRoles("user"), createReview);

// Public route to see doctor reviews
reviewRoute.get("/doctor/:doctorId", getDoctorReviews);

export default reviewRoute;
