/**
 * LifeLine – Database Seed Script
 * ---------------------------------
 * Run:  npx ts-node seed.ts
 *
 * ما يعمله:
 *  1. يمسح الكوليكشنز الخاصة بالداتا الوهمية (مش اليوزرز الحاليين)
 *  2. ينشئ 2 مريض + 3 طبيب
 *  3. ينشئ عيادة لكل طبيب
 *  4. يحدد جدول المتاحية لكل عيادة
 *  5. ينشئ حجوزات بحالات مختلفة
 */

require("dotenv").config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import userModel from "./models/user.model";
import doctorModel from "./models/doctor.model";
import clinicModel from "./models/clinic.model";
import availabilityModel from "./models/availability.model";
import appointmentModel from "./models/appointment.model";

const DB_URL = process.env.DB_URL as string;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dayName(date: Date) {
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
const PASSWORD_PLAIN = "Password@123";

const PATIENTS = [
  { name: "Ahmed Hassan",   email: "ahmed.patient@lifeline.com",  role: "patient", isVerified: true },
  { name: "Sara Mohamed",   email: "sara.patient@lifeline.com",   role: "patient", isVerified: true },
];

const DOCTORS_DATA = [
  {
    user: { name: "Dr. Khaled Nour",   email: "khaled.doctor@lifeline.com",  role: "doctor", isVerified: true },
    profile: { specialization: "Cardiology",    subSpecialization: "Interventional Cardiology", bio: "Expert cardiologist with 12 years of experience.", yearsOfExperience: 12, consultationFee: 500, isApproved: true },
    clinic: {
      name: "Al-Nour Heart Clinic",
      address: { governorate: "Cairo", city: "Nasr City", street: "Makram Ebeid St., Bld 15", lat: 30.0626, lng: 31.3473 },
      phone: "01012345678",
      workingHours: [
        { day: "Monday",    startTime: "09:00 AM", endTime: "05:00 PM" },
        { day: "Wednesday", startTime: "09:00 AM", endTime: "05:00 PM" },
        { day: "Thursday",  startTime: "10:00 AM", endTime: "04:00 PM" },
      ],
    },
    availability: {
      slotDuration: 20,
      workDays: ["Monday","Wednesday","Thursday"],
      startTime: "09:00",
      endTime: "17:00",
    },
  },
  {
    user: { name: "Dr. Rana Salah",    email: "rana.doctor@lifeline.com",    role: "doctor", isVerified: true },
    profile: { specialization: "Dermatology",   subSpecialization: "Cosmetic Dermatology",      bio: "Skin specialist with focus on cosmetic and medical dermatology.", yearsOfExperience: 8,  consultationFee: 400, isApproved: true },
    clinic: {
      name: "Glow Skin Clinic",
      address: { governorate: "Giza", city: "Dokki", street: "Tahrir Square Area", lat: 30.0406, lng: 31.2100 },
      phone: "01198765432",
      workingHours: [
        { day: "Sunday",   startTime: "10:00 AM", endTime: "06:00 PM" },
        { day: "Tuesday",  startTime: "10:00 AM", endTime: "06:00 PM" },
        { day: "Saturday", startTime: "11:00 AM", endTime: "03:00 PM" },
      ],
    },
    availability: {
      slotDuration: 30,
      workDays: ["Sunday","Tuesday","Saturday"],
      startTime: "10:00",
      endTime: "18:00",
    },
  },
  {
    user: { name: "Dr. Omar Fathy",    email: "omar.doctor@lifeline.com",    role: "doctor", isVerified: true },
    profile: { specialization: "Orthopedics",   subSpecialization: "Sports Medicine",           bio: "Orthopedic surgeon specialized in sports injuries and joint replacement.", yearsOfExperience: 15, consultationFee: 700, isApproved: true },
    clinic: {
      name: "Motion Orthopedic Center",
      address: { governorate: "Alexandria", city: "Smouha", street: "Victor Emanuel St.", lat: 31.2176, lng: 29.9553 },
      phone: "01234567890",
      workingHours: [
        { day: "Monday",    startTime: "08:00 AM", endTime: "02:00 PM" },
        { day: "Wednesday", startTime: "08:00 AM", endTime: "02:00 PM" },
        { day: "Friday",    startTime: "09:00 AM", endTime: "12:00 PM" },
      ],
    },
    availability: {
      slotDuration: 20,
      workDays: ["Monday","Wednesday","Friday"],
      startTime: "08:00",
      endTime: "14:00",
    },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱 Connecting to database…");
  await mongoose.connect(DB_URL);
  console.log("✅ Connected.\n");

  // ── 1. Wipe seed-related collections ──────────────────────────────────────
  console.log("🗑️  Clearing old seed data…");
  const seedEmails = [
    ...PATIENTS.map((p) => p.email),
    ...DOCTORS_DATA.map((d) => d.user.email),
  ];
  const oldUsers = await userModel.find({ email: { $in: seedEmails } });
  const oldUserIds = oldUsers.map((u) => u._id);
  const oldDoctors = await doctorModel.find({ userId: { $in: oldUserIds } });
  const oldDoctorIds = oldDoctors.map((d) => d._id);
  const oldClinics = await clinicModel.find({ doctorId: { $in: oldDoctorIds } });
  const oldClinicIds = oldClinics.map((c) => c._id);

  await appointmentModel.deleteMany({ clinicId: { $in: oldClinicIds } });
  await availabilityModel.deleteMany({ clinicId: { $in: oldClinicIds } });
  await clinicModel.deleteMany({ _id: { $in: oldClinicIds } });
  await doctorModel.deleteMany({ _id: { $in: oldDoctorIds } });
  await userModel.deleteMany({ email: { $in: seedEmails } });
  console.log("✅ Cleared.\n");

  // ── 2. Create patients ─────────────────────────────────────────────────────
  console.log("👤 Creating patients…");
  const hashedPwd = await bcrypt.hash(PASSWORD_PLAIN, 10);
  const patientUsers = await userModel.insertMany(
    PATIENTS.map((p) => ({ ...p, password: hashedPwd }))
  );
  console.log(`   ✅ ${patientUsers.length} patients created.`);

  // ── 3. Create doctors + clinics + availability ─────────────────────────────
  const createdDoctors: any[] = [];
  const createdClinics: any[] = [];

  for (const item of DOCTORS_DATA) {
    console.log(`\n🩺 Processing ${item.user.name}…`);

    // User
    const doctorUser = await userModel.create({ ...item.user, password: hashedPwd });

    // Doctor profile
    const doctor = await doctorModel.create({
      userId: doctorUser._id,
      ...item.profile,
    });

    // Clinic
    const clinic = await clinicModel.create({
      doctorId: doctor._id,
      ...item.clinic,
    });

    // Link clinic to doctor
    doctor.clinics.push(clinic._id);
    await doctor.save();

    // Availability (generate slots from workDays)
    const { slotDuration, workDays, startTime, endTime } = item.availability;
    const weeklySchedule = workDays.map((day) => ({
      day,
      slots: [{ start: startTime, end: endTime }],
    }));

    await availabilityModel.create({
      clinicId: clinic._id,
      weeklySchedule,
      slotDuration,
      exceptions: [
        // Example: next Friday is a holiday for all
        {
          date: daysFromNow(
            (5 - new Date().getDay() + 7) % 7 || 7
          ),
          isAvailable: false,
          reason: "National Holiday",
        },
      ],
    });

    console.log(`   ✅ Clinic: ${clinic.name}`);
    console.log(`   ✅ Availability: ${workDays.join(", ")} (${slotDuration} min slots)`);

    createdDoctors.push(doctor);
    createdClinics.push(clinic);
  }

  // ── 4. Create appointments ─────────────────────────────────────────────────
  console.log("\n📅 Creating appointments…");

  const patient1 = patientUsers[0];
  const patient2 = patientUsers[1];
  const doc1 = createdDoctors[0]; // Cardiology
  const doc2 = createdDoctors[1]; // Dermatology
  const doc3 = createdDoctors[2]; // Orthopedics
  const clinic1 = createdClinics[0];
  const clinic2 = createdClinics[1];
  const clinic3 = createdClinics[2];

  // Find upcoming valid dates for each doctor (next matching weekday)
  function nextWeekday(targetDay: string, offset = 0): Date {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const target = days.indexOf(targetDay);
    const today = new Date().getDay();
    let diff = (target - today + 7) % 7;
    if (diff === 0) diff = 7; // avoid today
    diff += offset * 7;
    return daysFromNow(diff);
  }

  const appointments = [
    // Patient 1 → Cardiology (confirmed)
    {
      patientId: patient1._id, doctorId: doc1._id, clinicId: clinic1._id,
      date: nextWeekday("Monday"),   startTime: "09:00", endTime: "09:20",
      reason: "Chest pain and shortness of breath", status: "confirmed",
    },
    // Patient 1 → Dermatology (pending)
    {
      patientId: patient1._id, doctorId: doc2._id, clinicId: clinic2._id,
      date: nextWeekday("Sunday"),   startTime: "10:00", endTime: "10:30",
      reason: "Skin rash on arms", status: "pending",
    },
    // Patient 2 → Orthopedics (confirmed)
    {
      patientId: patient2._id, doctorId: doc3._id, clinicId: clinic3._id,
      date: nextWeekday("Wednesday"), startTime: "08:00", endTime: "08:20",
      reason: "Knee pain after running", status: "confirmed",
    },
    // Patient 2 → Cardiology (pending)
    {
      patientId: patient2._id, doctorId: doc1._id, clinicId: clinic1._id,
      date: nextWeekday("Wednesday"), startTime: "09:20", endTime: "09:40",
      reason: "Routine heart checkup", status: "pending",
    },
    // Patient 1 → Cardiology (second slot, next week – completed)
    {
      patientId: patient1._id, doctorId: doc1._id, clinicId: clinic1._id,
      date: nextWeekday("Monday", 1), startTime: "09:40", endTime: "10:00",
      reason: "Follow-up visit",   status: "completed",
    },
    // Patient 2 → Dermatology (cancelled)
    {
      patientId: patient2._id, doctorId: doc2._id, clinicId: clinic2._id,
      date: nextWeekday("Tuesday"), startTime: "10:30", endTime: "11:00",
      reason: "Acne treatment",    status: "cancelled",
      cancelledBy: "patient",      cancellationReason: "Schedule conflict",
    },
    // Patient 1 → Orthopedics (no-show)
    {
      patientId: patient1._id, doctorId: doc3._id, clinicId: clinic3._id,
      date: nextWeekday("Friday"),  startTime: "09:00", endTime: "09:20",
      reason: "Shoulder pain",     status: "no-show",
    },
  ];

  await appointmentModel.insertMany(appointments);
  console.log(`   ✅ ${appointments.length} appointments created.`);

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("🎉  Seed completed successfully!\n");

  console.log("👤 PATIENTS (login credentials):");
  PATIENTS.forEach((p) => console.log(`   ${p.name.padEnd(20)} | ${p.email.padEnd(35)} | Password: ${PASSWORD_PLAIN}`));

  console.log("\n🩺 DOCTORS (login credentials):");
  DOCTORS_DATA.forEach((d) => console.log(`   ${d.user.name.padEnd(22)} | ${d.user.email.padEnd(35)} | Password: ${PASSWORD_PLAIN}`));

  console.log("\n📊 Appointments breakdown:");
  const counts: Record<string, number> = {};
  appointments.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
  Object.entries(counts).forEach(([s, n]) => console.log(`   ${s.padEnd(12)}: ${n}`));

  console.log("\n✅ Ready to test! The server is already running on port 8000.");
  console.log("═══════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
