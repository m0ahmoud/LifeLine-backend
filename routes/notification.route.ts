import express from "express";
import {
  getMyNotifications,
  markNotificationAsRead,
} from "../controllers/notification.controller";
import { isAuthenticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";

const notificationRoute = express.Router();

notificationRoute.get(
  "/",
  isAuthenticated,
  getMyNotifications
);

notificationRoute.put(
  "/:id/read",
  isAuthenticated,
  markNotificationAsRead
);

export default notificationRoute;
