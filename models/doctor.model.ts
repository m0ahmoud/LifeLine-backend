import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IService {
  name: string;
  price: number;
  type: "consultation" | "follow-up" | "procedure";
}

export interface IDoctor extends Document {
  userId: Types.ObjectId;
  specialization: string;
  subSpecialization?: string;
  bio?: string;
  yearsOfExperience?: number;
  certificates: string[];
  consultationFee?: number; // Legacy, kept for backwards compatibility
  services?: IService[];
  rating: number;
  reviewsCount: number;
  isApproved: boolean;
  clinics: Types.ObjectId[];
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      unique: true,
    },
    specialization: {
      type: String,
      required: [true, "Please enter your specialization"],
      trim: true,
    },
    subSpecialization: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      min: [0, "Years of experience cannot be negative"],
    },
    certificates: {
      type: [String],
      default: [],
    },
    consultationFee: {
      type: Number,
      min: [0, "Consultation fee cannot be negative"],
    },
    services: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        type: { type: String, enum: ["consultation", "follow-up", "procedure"], required: true }
      }
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 0,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    clinics: [
      {
        type: Schema.Types.ObjectId,
        ref: "Clinic",
      },
    ],
  },
  { timestamps: true, collection: "Doctors" },
);

const doctorModel: Model<IDoctor> = mongoose.model<IDoctor>(
  "Doctor",
  doctorSchema,
);
export default doctorModel;
