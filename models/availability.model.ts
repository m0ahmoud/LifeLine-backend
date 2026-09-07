import mongoose, { Document, Model, Schema, Types } from "mongoose";

interface ISlot {
  start: string; // "09:00"
  end: string;   // "09:20"
}

interface IDaySchedule {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  slots: ISlot[];
}

interface IException {
  date: Date;
  isAvailable: boolean;
  reason?: string;
}

export interface IAvailability extends Document {
  clinicId: Types.ObjectId;
  weeklySchedule: IDaySchedule[];
  slotDuration: number; // minutes
  exceptions: IException[];
}

const slotSchema = new Schema<ISlot>(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const dayScheduleSchema = new Schema<IDaySchedule>(
  {
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true,
    },
    slots: { type: [slotSchema], default: [] },
  },
  { _id: false },
);

const exceptionSchema = new Schema<IException>(
  {
    date: { type: Date, required: true },
    isAvailable: { type: Boolean, default: false },
    reason: { type: String },
  },
  { _id: false },
);

const availabilitySchema = new Schema<IAvailability>(
  {
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: [true, "Clinic reference is required"],
      unique: true,
    },
    weeklySchedule: { type: [dayScheduleSchema], default: [] },
    slotDuration: {
      type: Number,
      required: [true, "Slot duration is required"],
      min: [5, "Slot duration must be at least 5 minutes"],
      default: 20,
    },
    exceptions: { type: [exceptionSchema], default: [] },
  },
  { timestamps: true, collection: "Availabilities" },
);

const availabilityModel: Model<IAvailability> = mongoose.model<IAvailability>(
  "Availability",
  availabilitySchema,
);

export default availabilityModel;
