import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type PaymentMethod = "cash" | "online";
export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export interface IPayment extends Document {
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paymobOrderId?: string;
  paymobTransactionId?: string;
}

const paymentSchema = new Schema<IPayment>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true, // One payment per appointment
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "EGP",
    },
    method: {
      type: String,
      enum: ["cash", "online"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },
    paymobOrderId: {
      type: String,
    },
    paymobTransactionId: {
      type: String,
    },
  },
  { timestamps: true, collection: "Payments" },
);

const paymentModel: Model<IPayment> = mongoose.model<IPayment>(
  "Payment",
  paymentSchema,
);

export default paymentModel;
