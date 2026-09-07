import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import appointmentModel from "../models/appointment.model";
import doctorModel from "../models/doctor.model";
import availabilityModel from "../models/availability.model";
import clinicModel from "../models/clinic.model";
import userModel from "../models/user.model";
import notificationModel from "../models/notification.model";
import { getIo } from "../socketServer";
import sendEmail from "../utils/sendMail";

// ── Book Appointment ──────────────────────────────────────────────────────────
export const bookAppointment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      const { clinicId, date, startTime, reason } = req.body;

      if (!clinicId || !date || !startTime) {
        return next(
          new ErrorHandler("clinicId, date, and startTime are required", 400),
        );
      }

      // Ensure clinic exists and get doctorId
      const clinic = await clinicModel.findById(clinicId);
      if (!clinic) return next(new ErrorHandler("Clinic not found", 404));

      const doctor = await doctorModel.findById(clinic.doctorId);
      if (!doctor) return next(new ErrorHandler("Doctor not found", 404));

      // Verify availability configuration exists
      const availability = await availabilityModel.findOne({ clinicId });
      if (!availability) {
        return next(
          new ErrorHandler("This clinic has no availability set", 400),
        );
      }

      // Calculate endTime from startTime + slotDuration
      const toMinutes = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      const toTime = (mins: number) => {
        const h = Math.floor(mins / 60).toString().padStart(2, "0");
        const m = (mins % 60).toString().padStart(2, "0");
        return `${h}:${m}`;
      };
      const endTime = toTime(toMinutes(startTime) + availability.slotDuration);

      // Normalize date to midnight UTC
      const appointmentDate = new Date(date);
      appointmentDate.setUTCHours(0, 0, 0, 0);

      // Check for double booking (the DB index also guards this)
      const conflict = await appointmentModel.findOne({
        clinicId,
        date: appointmentDate,
        startTime,
        status: { $nin: ["cancelled"] },
      });

      if (conflict) {
        return next(
          new ErrorHandler(
            "This slot is already booked. Please choose another time.",
            409,
          ),
        );
      }

      const appointment = await appointmentModel.create({
        patientId,
        doctorId: doctor._id,
        clinicId,
        date: appointmentDate,
        startTime,
        endTime,
        reason,
        status: "pending",
      });

      // Fetch patient for email/notification
      const patient = await userModel.findById(patientId);
      const doctorUser = await userModel.findById(doctor.userId);

      if (patient && doctorUser) {
        const msg = `New appointment booked with ${doctorUser.name} on ${appointmentDate.toLocaleDateString()} at ${startTime}`;
        
        // Create Notification
        const notification = await notificationModel.create({
          userId: patient._id,
          type: "booking_confirmed",
          message: msg,
          relatedAppointmentId: appointment._id,
        });

        // Emit real-time socket event
        try {
          const io = getIo();
          io.to(patient._id.toString()).emit("newNotification", notification);
          // Also notify doctor
          const docNotification = await notificationModel.create({
            userId: doctorUser._id,
            type: "booking_confirmed",
            message: `New appointment booked by ${patient.name} on ${appointmentDate.toLocaleDateString()} at ${startTime}`,
            relatedAppointmentId: appointment._id,
          });
          io.to(doctorUser._id.toString()).emit("newNotification", docNotification);
        } catch (e) {
          console.error("Socket error", e);
        }

        // Send Email
        try {
          await sendEmail({
            email: patient.email,
            subject: "Appointment Confirmed",
            template: "booking-confirmation.mail.ejs",
            data: {
              patientName: patient.name,
              doctorName: doctorUser.name,
              clinicName: clinic.name,
              date: appointmentDate.toLocaleDateString(),
              time: startTime,
            },
          });
        } catch (e) {
          console.error("Email error", e);
        }
      }

      res.status(201).json({ success: true, appointment });
    } catch (error: any) {
      // Handle MongoDB unique index violation (race condition)
      if (error.code === 11000) {
        return next(
          new ErrorHandler(
            "This slot was just booked. Please choose another time.",
            409,
          ),
        );
      }
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Update Appointment Status ─────────────────────────────────────────────────
// Doctor: confirm, completed, no-show
// Patient: cancel
// Admin: all
export const updateAppointmentStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, cancellationReason } = req.body;
      const userRole = req.user.role;
      const userId = req.user._id;

      const appointment = await appointmentModel.findById(id);
      if (!appointment) {
        return next(new ErrorHandler("Appointment not found", 404));
      }

      const allowedTransitions: Record<string, string[]> = {
        patient: ["cancelled"],
        doctor: ["confirmed", "completed", "no-show", "cancelled"],
        admin: ["pending", "confirmed", "cancelled", "completed", "no-show"],
      };

      const allowed = allowedTransitions[userRole] || [];
      if (!allowed.includes(status)) {
        return next(
          new ErrorHandler(
            `As a ${userRole}, you cannot set status to "${status}"`,
            403,
          ),
        );
      }

      // Patients can only cancel their own appointments
      if (userRole === "patient") {
        if (appointment.patientId.toString() !== userId.toString()) {
          return next(
            new ErrorHandler("You can only manage your own appointments", 403),
          );
        }
      }

      // Doctors can only manage appointments in their clinics
      if (userRole === "doctor") {
        const doctor = await doctorModel.findOne({ userId });
        if (!doctor || appointment.doctorId.toString() !== (doctor._id as any).toString()) {
          return next(
            new ErrorHandler(
              "You can only manage appointments for your clinics",
              403,
            ),
          );
        }
      }

      appointment.status = status;
      if (status === "cancelled") {
        appointment.cancelledBy = userRole as any;
        if (cancellationReason) appointment.cancellationReason = cancellationReason;
      }

      await appointment.save();

      // Notifications logic
      if (status === "cancelled" || status === "confirmed" || status === "completed") {
        const patient = await userModel.findById(appointment.patientId);
        let doctorUserId = null;
        if (userRole === "doctor") {
          doctorUserId = userId;
        } else {
          const doc = await doctorModel.findById(appointment.doctorId);
          if (doc) doctorUserId = doc.userId;
        }

        const notifyUserId = userRole === "patient" ? doctorUserId : appointment.patientId;
        const msg = `Appointment on ${new Date(appointment.date).toLocaleDateString()} was marked as ${status}`;
        
        if (notifyUserId) {
          const notification = await notificationModel.create({
            userId: notifyUserId,
            type: status === "cancelled" ? "booking_cancelled" : "booking_modified",
            message: msg,
            relatedAppointmentId: appointment._id,
          });

          try {
            const io = getIo();
            io.to(notifyUserId.toString()).emit("newNotification", notification);
          } catch (e) {
             console.error("Socket error", e);
          }
        }
      }

      res.status(200).json({ success: true, appointment });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Patient's Own Appointments ────────────────────────────────────────────
export const getMyPatientAppointments = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.user._id;
      const { status, page = 1, limit = 10 } = req.query;

      const filter: any = { patientId };
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const total = await appointmentModel.countDocuments(filter);

      const appointments = await appointmentModel
        .find(filter)
        .populate("clinicId", "name address phone")
        .populate({
          path: "doctorId",
          select: "specialization consultationFee userId",
          populate: { path: "userId", select: "name avatar" },
        })
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        appointments,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Doctor's Appointments (Dashboard) ─────────────────────────────────────
export const getDoctorAppointments = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });
      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

      const filter: any = { doctorId: doctor._id };
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) {
          const s = new Date(startDate as string);
          s.setUTCHours(0, 0, 0, 0);
          filter.date.$gte = s;
        }
        if (endDate) {
          const e = new Date(endDate as string);
          e.setUTCHours(23, 59, 59, 999);
          filter.date.$lte = e;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const total = await appointmentModel.countDocuments(filter);

      const appointments = await appointmentModel
        .find(filter)
        .populate("patientId", "name email avatar phone")
        .populate("clinicId", "name address phone")
        .sort({ date: 1, startTime: 1 })
        .skip(skip)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        appointments,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Single Appointment by ID ──────────────────────────────────────────────
export const getAppointmentById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await appointmentModel
        .findById(req.params.id)
        .populate("patientId", "name email avatar phone")
        .populate("clinicId", "name address phone")
        .populate({
          path: "doctorId",
          select: "specialization consultationFee userId",
          populate: { path: "userId", select: "name avatar" },
        });

      if (!appointment) {
        return next(new ErrorHandler("Appointment not found", 404));
      }

      res.status(200).json({ success: true, appointment });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
