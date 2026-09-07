import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import reviewModel from "../models/review.model";
import appointmentModel from "../models/appointment.model";
import doctorModel from "../models/doctor.model";

// ── Create Review ─────────────────────────────────────────────────────────────
export const createReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      const { appointmentId, rating, comment } = req.body;

      if (!appointmentId || !rating) {
        return next(
          new ErrorHandler("appointmentId and rating are required", 400),
        );
      }

      // Check if appointment exists and belongs to the patient
      const appointment = await appointmentModel.findById(appointmentId);
      if (!appointment) {
        return next(new ErrorHandler("Appointment not found", 404));
      }

      if (appointment.patientId.toString() !== patientId.toString()) {
        return next(
          new ErrorHandler("You can only review your own appointments", 403),
        );
      }

      // Ensure appointment is completed
      if (appointment.status !== "completed") {
        return next(
          new ErrorHandler("You can only review completed appointments", 400),
        );
      }

      const doctorId = appointment.doctorId;

      // Create the review
      const review = await reviewModel.create({
        appointmentId,
        patientId,
        doctorId,
        rating,
        comment,
      });

      // Recalculate average rating for the doctor
      const stats = await reviewModel.aggregate([
        { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
        {
          $group: {
            _id: "$doctorId",
            averageRating: { $avg: "$rating" },
            numOfReviews: { $sum: 1 },
          },
        },
      ]);

      if (stats.length > 0) {
        await doctorModel.findByIdAndUpdate(doctorId, {
          rating: Math.round(stats[0].averageRating * 10) / 10,
          reviewsCount: stats[0].numOfReviews,
        });
      }

      res.status(201).json({ success: true, review });
    } catch (error: any) {
      if (error.code === 11000) {
        return next(
          new ErrorHandler("You have already reviewed this appointment", 409),
        );
      }
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Doctor Reviews ───────────────────────────────────────────────────────
export const getDoctorReviews = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { doctorId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const total = await reviewModel.countDocuments({ doctorId });
      const reviews = await reviewModel
        .find({ doctorId })
        .populate("patientId", "name avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        reviews,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
