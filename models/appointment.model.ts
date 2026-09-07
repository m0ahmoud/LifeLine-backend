import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no-show";

export interface IAppointment extends Document {
  patientId: Types.ObjectId;
  dependentId?: Types.ObjectId; // Optional link to a dependent in user's profile
  doctorId: Types.ObjectId;
  clinicId: Types.ObjectId;
  date: Date;          // The day (stored as midnight UTC, e.g., 2026-09-10T00:00:00Z)
  startTime: string;   // "09:20"
  endTime: string;     // "09:40"
  serviceName?: string; // Name of the selected service
  servicePrice?: number; // Snapshot of the price at booking time
  reason?: string;
  status: AppointmentStatus;
  cancelledBy?: "patient" | "doctor" | "admin";
  cancellationReason?: string;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient reference is required"],
    },
    dependentId: {
      type: Schema.Types.ObjectId,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor reference is required"],
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: [true, "Clinic reference is required"],
    },
    date: {
      type: Date,
      required: [true, "Appointment date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
    },
    serviceName: { type: String },
    servicePrice: { type: Number },
    reason: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
      default: "pending",
    },
    cancelledBy: {
      type: String,
      enum: ["patient", "doctor", "admin"],
    },
    cancellationReason: { type: String },
  },
  { timestamps: true, collection: "Appointments" },
);

// Compound index to prevent double booking
appointmentSchema.index(
  { clinicId: 1, date: 1, startTime: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } } },
);

const appointmentModel: Model<IAppointment> = mongoose.model<IAppointment>(
  "Appointment",
  appointmentSchema,
);

export default appointmentModel;
