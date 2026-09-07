import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMedicalRecord extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  diagnosis: string;
  prescription: string;
  notes?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const medicalRecordSchema = new Schema<IMedicalRecord>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment reference is required"],
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient reference is required"],
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor reference is required"],
    },
    diagnosis: {
      type: String,
      required: [true, "Diagnosis is required"],
    },
    prescription: {
      type: String,
      required: [true, "Prescription is required"],
    },
    notes: { type: String },
    attachments: [{ type: String }],
  },
  { timestamps: true, collection: "MedicalRecords" },
);

// One medical record per appointment
medicalRecordSchema.index({ appointmentId: 1 }, { unique: true });

const medicalRecordModel: Model<IMedicalRecord> = mongoose.model<IMedicalRecord>(
  "MedicalRecord",
  medicalRecordSchema,
);

export default medicalRecordModel;
