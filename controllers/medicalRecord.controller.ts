import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import medicalRecordModel from "../models/medicalRecord.model";
import appointmentModel from "../models/appointment.model";
import doctorModel from "../models/doctor.model";
import cloudinary from "cloudinary";

// ── Create Medical Record (Doctor Only) ───────────────────────────────────────
export const createMedicalRecord = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appointmentId, diagnosis, prescription, notes, attachments } = req.body;
      const userId = req.user._id;

      if (!appointmentId || !diagnosis || !prescription) {
        return next(
          new ErrorHandler("appointmentId, diagnosis, and prescription are required", 400),
        );
      }

      // Verify the doctor
      const doctor = await doctorModel.findOne({ userId });
      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      // Verify the appointment belongs to this doctor
      const appointment = await appointmentModel.findById(appointmentId);
      if (!appointment) {
        return next(new ErrorHandler("Appointment not found", 404));
      }

      if (appointment.doctorId.toString() !== (doctor._id as any).toString()) {
        return next(new ErrorHandler("You can only write reports for your own appointments", 403));
      }

      // Check if a record already exists
      const existingRecord = await medicalRecordModel.findOne({ appointmentId });
      if (existingRecord) {
        return next(new ErrorHandler("A medical record already exists for this appointment", 409));
      }

      // Handle attachments upload to Cloudinary (assuming base64 strings in `attachments` array)
      const uploadedAttachments: string[] = [];
      if (attachments && Array.isArray(attachments)) {
        for (const file of attachments) {
          if (typeof file === "string" && file.startsWith("data:")) {
            const myCloud = await cloudinary.v2.uploader.upload(file, {
              folder: "medical_records",
            });
            uploadedAttachments.push(myCloud.secure_url);
          } else if (typeof file === "string") {
             // If already a url, keep it
             uploadedAttachments.push(file);
          }
        }
      }

      // Automatically complete the appointment when a report is written
      if (appointment.status !== "completed") {
        appointment.status = "completed";
        await appointment.save();
      }

      const medicalRecord = await medicalRecordModel.create({
        appointmentId,
        patientId: appointment.patientId,
        doctorId: doctor._id,
        diagnosis,
        prescription,
        notes,
        attachments: uploadedAttachments,
      });

      res.status(201).json({ success: true, medicalRecord });
    } catch (error: any) {
      if (error.code === 11000) {
        return next(new ErrorHandler("A medical record already exists for this appointment", 409));
      }
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Patient's Medical History ─────────────────────────────────────────────
export const getPatientMedicalHistory = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const filter = { patientId };

      const total = await medicalRecordModel.countDocuments(filter);
      const records = await medicalRecordModel
        .find(filter)
        .populate("appointmentId", "date startTime endTime")
        .populate({
          path: "doctorId",
          select: "specialization userId",
          populate: { path: "userId", select: "name avatar" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        records,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Single Medical Record by Appointment ID ───────────────────────────────
export const getAppointmentMedicalRecord = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { appointmentId } = req.params;
      const userId = req.user._id;
      const userRole = req.user.role;

      const record = await medicalRecordModel
        .findOne({ appointmentId })
        .populate("appointmentId", "date startTime endTime status reason")
        .populate("patientId", "name email phone avatar")
        .populate({
          path: "doctorId",
          select: "specialization userId",
          populate: { path: "userId", select: "name avatar" },
        });

      if (!record) {
        return next(new ErrorHandler("Medical record not found", 404));
      }

      // Security Check: Only the involved patient, the involved doctor, or an admin can view this.
      if (userRole === "patient" && record.patientId._id.toString() !== userId.toString()) {
        return next(new ErrorHandler("Unauthorized access to this medical record", 403));
      }

      if (userRole === "doctor") {
        const doctor = await doctorModel.findOne({ userId });
        if (!doctor || record.doctorId._id.toString() !== (doctor._id as any).toString()) {
           return next(new ErrorHandler("Unauthorized access to this medical record", 403));
        }
      }

      res.status(200).json({ success: true, record });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
