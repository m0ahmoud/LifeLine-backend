require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import userModel from "../models/user.model";
import doctorModel from "../models/doctor.model";
import appointmentModel from "../models/appointment.model";
import paymentModel from "../models/payment.model";

// ── Get Dashboard Stats ───────────────────────────────────────────────────────
export const getDashboardStats = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const totalUsers = await userModel.countDocuments({ role: "user" });
      const totalDoctors = await doctorModel.countDocuments();
      const totalAppointments = await appointmentModel.countDocuments();

      // Total Revenue
      const revenueAggr = await paymentModel.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const totalRevenue = revenueAggr.length > 0 ? revenueAggr[0].total : 0;

      // Recent Appointments
      const recentAppointments = await appointmentModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("patientId", "name avatar")
        .populate({
          path: "doctorId",
          populate: { path: "userId", select: "name avatar" }
        });

      // Bookings & Revenue over last 7 days
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);

      const chartDataAggr = await paymentModel.aggregate([
        {
          $match: {
            status: "paid",
            createdAt: { $gte: last7Days },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const chartData = chartDataAggr.map((item) => ({
        date: item._id,
        revenue: item.revenue,
        bookings: item.bookings,
      }));

      res.status(200).json({
        success: true,
        stats: {
          totalUsers,
          totalDoctors,
          totalAppointments,
          totalRevenue,
        },
        recentAppointments,
        chartData,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ── Admin: Get All Users ──────────────────────────────────────────────────────
export const adminGetAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await userModel.find().sort({ createdAt: -1 }).select("-password");
      res.status(200).json({
        success: true,
        users,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ── Admin: Update User Status (Block/Unblock) ─────────────────────────────────
export const adminUpdateUserStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isBlocked } = req.body;

      const user = await userModel.findById(id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Prevent admin from blocking themselves
      if (user._id.toString() === req.user._id.toString()) {
         return next(new ErrorHandler("You cannot block yourself", 400));
      }

      user.isBlocked = isBlocked;
      await user.save();

      res.status(200).json({
        success: true,
        message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ── Admin: Get All Doctors (including unapproved) ─────────────────────────────
export const adminGetAllDoctors = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctors = await doctorModel
        .find()
        .sort({ createdAt: -1 })
        .populate("userId", "name email avatar");

      res.status(200).json({
        success: true,
        doctors,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ── Admin: Get All Appointments ───────────────────────────────────────────────
export const adminGetAllAppointments = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointments = await appointmentModel
        .find()
        .sort({ createdAt: -1 })
        .populate("patientId", "name email")
        .populate({
          path: "doctorId",
          populate: { path: "userId", select: "name" }
        })
        .populate("clinicId", "name");

      res.status(200).json({
        success: true,
        appointments,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
