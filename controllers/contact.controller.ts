import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import sendEmail from "../utils/sendMail";

// ── Send Contact Message ──────────────────────────────────────────────────────
export const sendContactMessage = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, subject, message } = req.body;

      // Basic validation
      if (!name || !email || !subject || !message) {
        return next(new ErrorHandler("All fields are required", 400));
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return next(new ErrorHandler("Invalid email address", 400));
      }

      if (message.trim().length < 10) {
        return next(
          new ErrorHandler("Message must be at least 10 characters", 400)
        );
      }

      // Send notification to admin
      const adminEmail = process.env.SMTP_EMAIL || "admin@lifeline.com";
      await sendEmail({
        email: adminEmail,
        subject: `[LifeLine Contact] ${subject}`,
        template: "contact.mail.ejs",
        data: { name, email, subject, message },
      });

      // Send confirmation to user
      await sendEmail({
        email,
        subject: "We received your message — LifeLine",
        template: "contact-confirm.mail.ejs",
        data: { name, subject },
      });

      res.status(200).json({
        success: true,
        message: "Your message has been sent successfully.",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
