import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import availabilityModel from "../models/availability.model";
import appointmentModel from "../models/appointment.model";
import doctorModel from "../models/doctor.model";
import clinicModel from "../models/clinic.model";

// ── Helper: Generate all time slots for a day ──────────────────────────────────
function generateSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  let current = toMinutes(startTime);
  const end = toMinutes(endTime);

  while (current + durationMinutes <= end) {
    slots.push({ start: toTime(current), end: toTime(current + durationMinutes) });
    current += durationMinutes;
  }

  return slots;
}

// ── Set / Update Availability ─────────────────────────────────────────────────
export const setAvailability = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });

      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      const { clinicId, weeklySchedule, slotDuration, exceptions } = req.body;

      if (!clinicId || !weeklySchedule || !slotDuration) {
        return next(
          new ErrorHandler(
            "clinicId, weeklySchedule, and slotDuration are required",
            400,
          ),
        );
      }

      // Verify clinic belongs to this doctor
      const clinic = await clinicModel.findById(clinicId);
      if (!clinic) return next(new ErrorHandler("Clinic not found", 404));
      if (clinic.doctorId.toString() !== (doctor._id as any).toString()) {
        return next(
          new ErrorHandler("You are not authorized for this clinic", 403),
        );
      }

      const availability = await availabilityModel.findOneAndUpdate(
        { clinicId },
        { clinicId, weeklySchedule, slotDuration, exceptions: exceptions || [] },
        { upsert: true, new: true, runValidators: true },
      );

      res.status(200).json({ success: true, availability });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Availability Settings for a Clinic ────────────────────────────────────
export const getAvailability = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const availability = await availabilityModel.findOne({
        clinicId: req.params.clinicId,
      });

      if (!availability) {
        return next(
          new ErrorHandler("No availability set for this clinic", 404),
        );
      }

      res.status(200).json({ success: true, availability });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Available Slots for a specific date ───────────────────────────────────
export const getAvailableSlots = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clinicId, date } = req.query as { clinicId: string; date: string };

      if (!clinicId || !date) {
        return next(
          new ErrorHandler("clinicId and date query params are required", 400),
        );
      }

      const availability = await availabilityModel.findOne({ clinicId });
      if (!availability) {
        return next(
          new ErrorHandler("No availability set for this clinic", 404),
        );
      }

      const requestedDate = new Date(date);
      if (isNaN(requestedDate.getTime())) {
        return next(new ErrorHandler("Invalid date format", 400));
      }

      // Check exceptions for this specific date
      const exceptionEntry = availability.exceptions.find((ex) => {
        const exDate = new Date(ex.date);
        return (
          exDate.getFullYear() === requestedDate.getFullYear() &&
          exDate.getMonth() === requestedDate.getMonth() &&
          exDate.getDate() === requestedDate.getDate()
        );
      });

      if (exceptionEntry && !exceptionEntry.isAvailable) {
        return res.status(200).json({
          success: true,
          date,
          reason: exceptionEntry.reason || "Clinic unavailable on this date",
          slots: [],
        });
      }

      // Get the day name from the requested date
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[requestedDate.getDay()];

      // Find the weekly schedule for that day
      const daySchedule = availability.weeklySchedule.find(
        (d) => d.day === dayName,
      );

      if (!daySchedule || daySchedule.slots.length === 0) {
        return res.status(200).json({
          success: true,
          date,
          reason: "Clinic is closed on this day",
          slots: [],
        });
      }

      // Generate all possible slots from each working block
      let allSlots: { start: string; end: string }[] = [];
      for (const block of daySchedule.slots) {
        const generated = generateSlots(
          block.start,
          block.end,
          availability.slotDuration,
        );
        allSlots = allSlots.concat(generated);
      }

      // Fetch already booked appointments for this clinic+date
      const startOfDay = new Date(requestedDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const bookedAppointments = await appointmentModel.find({
        clinicId,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ["cancelled"] },
      });

      const bookedStartTimes = new Set(bookedAppointments.map((a) => a.startTime));

      // Filter out booked slots
      const availableSlots = allSlots.filter(
        (slot) => !bookedStartTimes.has(slot.start),
      );

      res.status(200).json({
        success: true,
        date,
        slotDuration: availability.slotDuration,
        totalSlots: allSlots.length,
        availableCount: availableSlots.length,
        slots: availableSlots,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
