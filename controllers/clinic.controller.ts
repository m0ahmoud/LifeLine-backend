require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import clinicModel from "../models/clinic.model";
import doctorModel from "../models/doctor.model";

// ── Create Clinic ─────────────────────────────────────────────────────────────
export const createClinic = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });

      if (!doctor) {
        return next(
          new ErrorHandler("Doctor profile not found. Create your profile first.", 404),
        );
      }

      const { name, address, phone, workingHours, images } = req.body;

      if (!name || !address || !phone) {
        return next(
          new ErrorHandler("Please provide clinic name, address, and phone", 400),
        );
      }

      // Upload clinic images to Cloudinary
      const uploadedImages: string[] = [];
      if (images && Array.isArray(images)) {
        for (const img of images) {
          const result = await cloudinary.v2.uploader.upload(img, {
            folder: "clinic-images",
          });
          uploadedImages.push(result.secure_url);
        }
      }

      const clinic = await clinicModel.create({
        doctorId: doctor._id,
        name,
        address,
        phone,
        workingHours: workingHours || [],
        images: uploadedImages,
      });

      // Add clinic to the doctor's clinics array
      doctor.clinics.push(clinic._id);
      await doctor.save();

      res.status(201).json({ success: true, clinic });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Update Clinic ─────────────────────────────────────────────────────────────
export const updateClinic = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });

      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      const clinic = await clinicModel.findById(req.params.id);

      if (!clinic) {
        return next(new ErrorHandler("Clinic not found", 404));
      }

      // Ensure the clinic belongs to this doctor
      if (clinic.doctorId.toString() !== (doctor._id as any).toString()) {
        return next(
          new ErrorHandler("You are not authorized to update this clinic", 403),
        );
      }

      const { name, address, phone, workingHours, newImages } = req.body;

      if (name) clinic.name = name;
      if (address) clinic.address = address;
      if (phone) clinic.phone = phone;
      if (workingHours) clinic.workingHours = workingHours;

      // Upload and append new images
      if (newImages && Array.isArray(newImages)) {
        for (const img of newImages) {
          const result = await cloudinary.v2.uploader.upload(img, {
            folder: "clinic-images",
          });
          clinic.images.push(result.secure_url);
        }
      }

      await clinic.save();
      res.status(200).json({ success: true, clinic });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Delete Clinic ─────────────────────────────────────────────────────────────
export const deleteClinic = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });

      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      const clinic = await clinicModel.findById(req.params.id);

      if (!clinic) {
        return next(new ErrorHandler("Clinic not found", 404));
      }

      // Ensure the clinic belongs to this doctor
      if (clinic.doctorId.toString() !== (doctor._id as any).toString()) {
        return next(
          new ErrorHandler("You are not authorized to delete this clinic", 403),
        );
      }

      await clinic.deleteOne();

      // Remove clinic from doctor's clinics array
      doctor.clinics = doctor.clinics.filter(
        (c) => c.toString() !== req.params.id,
      );
      await doctor.save();

      res.status(200).json({ success: true, message: "Clinic deleted successfully" });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Clinic by ID ──────────────────────────────────────────────────────────
export const getClinicById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinic = await clinicModel
        .findById(req.params.id)
        .populate("doctorId", "specialization consultationFee rating userId");

      if (!clinic) {
        return next(new ErrorHandler("Clinic not found", 404));
      }

      res.status(200).json({ success: true, clinic });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
