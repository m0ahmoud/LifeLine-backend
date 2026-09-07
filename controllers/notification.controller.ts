import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import notificationModel from "../models/notification.model";

// ── Get My Notifications ──────────────────────────────────────────────────────
export const getMyNotifications = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;

      const notifications = await notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(50); // Get latest 50 notifications

      const unreadCount = await notificationModel.countDocuments({
        userId,
        isRead: false,
      });

      res.status(200).json({
        success: true,
        unreadCount,
        notifications,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Mark Notification as Read ─────────────────────────────────────────────────
export const markNotificationAsRead = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      let notification;

      if (id === "all") {
        await notificationModel.updateMany({ userId, isRead: false }, { isRead: true });
      } else {
        notification = await notificationModel.findOneAndUpdate(
          { _id: id, userId },
          { isRead: true },
          { new: true }
        );

        if (!notification) {
          return next(new ErrorHandler("Notification not found", 404));
        }
      }

      res.status(200).json({ success: true, notification });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
