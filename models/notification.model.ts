import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: "booking_confirmed" | "booking_cancelled" | "booking_modified" | "reminder";
  message: string;
  isRead: boolean;
  relatedAppointmentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    type: {
      type: String,
      enum: ["booking_confirmed", "booking_cancelled", "booking_modified", "reminder"],
      required: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedAppointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
    },
  },
  { timestamps: true, collection: "Notifications" }
);

const notificationModel: Model<INotification> = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default notificationModel;
