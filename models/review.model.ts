import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IReview extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
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
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true, collection: "Reviews" }
);

// Ensure one review per appointment
reviewSchema.index({ appointmentId: 1, patientId: 1 }, { unique: true });

const reviewModel: Model<IReview> = mongoose.model<IReview>(
  "Review",
  reviewSchema
);

export default reviewModel;
