import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import {
  initiatePayment,
  paymobWebhook,
  getMyPayments,
} from "../controllers/payment.controller";

const paymentRoute = express.Router();

// Patient routes
paymentRoute.post(
  "/initiate",
  isAuthenticated,
  authorizeRoles("user", "admin"),
  initiatePayment,
);
paymentRoute.get(
  "/my",
  isAuthenticated,
  authorizeRoles("user", "admin"),
  getMyPayments,
);

// Webhook (Public, called by Paymob)
paymentRoute.post("/webhook", paymobWebhook);

export default paymentRoute;
