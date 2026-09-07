import cron from "node-cron";
import appointmentModel from "../models/appointment.model";
import userModel from "../models/user.model";
import doctorModel from "../models/doctor.model";
import notificationModel from "../models/notification.model";
import { getIo } from "../socketServer";
import sendEmail from "../utils/sendMail";

// Runs every hour
export const initCronJobs = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("Running reminder cron job...");
    try {
      // Find appointments exactly tomorrow
      const now = new Date();
      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setUTCHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setUTCHours(23, 59, 59, 999);

      const upcomingAppointments = await appointmentModel.find({
        date: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: "confirmed",
      });

      for (const appt of upcomingAppointments) {
        // Here we could check if a reminder was already sent for this appointment,
        // but for simplicity we assume we send it exactly 24h before (or just once a day).
        // Let's only send a reminder if it hasn't been sent yet.
        const existingReminder = await notificationModel.findOne({
          relatedAppointmentId: appt._id,
          type: "reminder",
        });

        if (existingReminder) continue;

        const patient = await userModel.findById(appt.patientId);
        const doctor = await doctorModel.findById(appt.doctorId);
        const docUser = doctor ? await userModel.findById(doctor.userId) : null;

        if (patient && docUser) {
          const msg = `Reminder: You have an appointment tomorrow at ${appt.startTime} with ${docUser.name}.`;
          
          // In-app notification
          const notification = await notificationModel.create({
            userId: patient._id,
            type: "reminder",
            message: msg,
            relatedAppointmentId: appt._id,
          });

          try {
            const io = getIo();
            io.to(patient._id.toString()).emit("newNotification", notification);
          } catch (e) {
            console.error("Socket error in cron:", e);
          }

          // Email
          try {
            await sendEmail({
              email: patient.email,
              subject: "Appointment Reminder",
              template: "reminder.mail.ejs",
              data: {
                patientName: patient.name,
                doctorName: docUser.name,
                date: new Date(appt.date).toLocaleDateString(),
                time: appt.startTime,
              },
            });
          } catch (e) {
             console.error("Email error in cron:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error running reminder cron job:", error);
    }
  });
};
