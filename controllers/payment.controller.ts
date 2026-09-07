require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import paymentModel from "../models/payment.model";
import appointmentModel from "../models/appointment.model";
import doctorModel from "../models/doctor.model";

// ── Initiate Payment ──────────────────────────────────────────────────────────
export const initiatePayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      const { appointmentId, method } = req.body;

      if (!appointmentId || !method) {
        return next(new ErrorHandler("Please provide appointmentId and method", 400));
      }

      const appointment = await appointmentModel.findOne({
        _id: appointmentId,
        patientId,
      });

      if (!appointment) {
        return next(new ErrorHandler("Appointment not found", 404));
      }

      if (appointment.status === "cancelled") {
        return next(new ErrorHandler("Cannot pay for a cancelled appointment", 400));
      }

      // Check if payment already exists
      const existingPayment = await paymentModel.findOne({ appointmentId });
      if (existingPayment && existingPayment.status === "paid") {
        return next(new ErrorHandler("Appointment is already paid", 400));
      }

      // Get doctor's fee
      const doctor = await doctorModel.findById(appointment.doctorId);
      if (!doctor || doctor.consultationFee === undefined) {
        return next(new ErrorHandler("Doctor consultation fee not set", 400));
      }
      const amount = doctor.consultationFee;

      let payment = existingPayment;

      if (!payment) {
        payment = await paymentModel.create({
          appointmentId,
          patientId,
          amount,
          method,
          status: "pending",
        });
      } else {
        payment.method = method;
        await payment.save();
      }

      if (method === "cash") {
        // Mark as confirmed immediately
        appointment.status = "confirmed";
        await appointment.save();

        res.status(200).json({
          success: true,
          message: "Cash payment initiated, appointment confirmed.",
          payment,
        });
      } else if (method === "online") {
        // Here we would integrate with Paymob API to get an iframe URL
        // For now, we return a mock URL that redirects back to our frontend
        // Assuming frontend runs on localhost:3000 for local dev
        const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        
        // Mock Paymob iframe URL (in reality, this would be a paymob.com URL)
        // We'll pass the payment ID so we can simulate the webhook on the frontend if needed
        const iframeUrl = `${baseUrl}/en/payment/mock-paymob?paymentId=${payment._id}&amount=${amount}`;

        res.status(200).json({
          success: true,
          iframeUrl,
          payment,
        });
      } else {
        return next(new ErrorHandler("Invalid payment method", 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// ── Paymob Webhook ────────────────────────────────────────────────────────────
export const paymobWebhook = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In a real implementation, we would verify the HMAC signature from Paymob
      // using process.env.PAYMOB_HMAC_SECRET

      const { obj } = req.body; // Paymob sends data inside 'obj'

      // Mock webhook payload handling
      // We assume the payload contains our payment ID in some custom field or order reference
      const paymentId = req.body.paymentId || obj?.order?.merchant_order_id; 
      const success = req.body.success !== undefined ? req.body.success : obj?.success;

      if (!paymentId) {
         return res.status(400).json({ success: false, message: "No payment ID" });
      }

      const payment = await paymentModel.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ success: false, message: "Payment not found" });
      }

      if (success === true || success === "true") {
        payment.status = "paid";
        payment.paymobTransactionId = req.body.transactionId || obj?.id;
        await payment.save();

        const appointment = await appointmentModel.findById(payment.appointmentId);
        if (appointment) {
          appointment.status = "confirmed";
          await appointment.save();
        }
      } else {
        payment.status = "failed";
        await payment.save();
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ success: false, message: "Webhook processing failed" });
    }
  }
);

// ── Get My Payments ───────────────────────────────────────────────────────────
export const getMyPayments = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      
      const payments = await paymentModel
        .find({ patientId })
        .populate("appointmentId", "date startTime status")
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        payments,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
