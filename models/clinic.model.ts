import mongoose, { Document, Model, Schema, Types } from "mongoose";

interface IWorkingHour {
  day: string;
  startTime: string;
  endTime: string;
}

interface IAddress {
  governorate: string;
  city: string;
  street?: string;
  lat?: number;
  lng?: number;
}

export interface IClinic extends Document {
  doctorId: Types.ObjectId;
  name: string;
  address: IAddress;
  phone: string;
  workingHours: IWorkingHour[];
  images: string[];
}

const workingHourSchema = new Schema<IWorkingHour>(
  {
    day: { type: String, required: [true, "Day is required"] },
    startTime: { type: String, required: [true, "Start time is required"] },
    endTime: { type: String, required: [true, "End time is required"] },
  },
  { _id: false },
);

const addressSchema = new Schema<IAddress>(
  {
    governorate: { type: String, required: [true, "Governorate is required"] },
    city: { type: String, required: [true, "City is required"] },
    street: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false },
);

const clinicSchema = new Schema<IClinic>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor reference is required"],
    },
    name: {
      type: String,
      required: [true, "Please enter clinic name"],
      trim: true,
    },
    address: {
      type: addressSchema,
      required: [true, "Address is required"],
    },
    phone: {
      type: String,
      required: [true, "Please enter clinic phone number"],
    },
    workingHours: {
      type: [workingHourSchema],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true, collection: "Clinics" },
);

const clinicModel: Model<IClinic> = mongoose.model<IClinic>(
  "Clinic",
  clinicSchema,
);
export default clinicModel;
