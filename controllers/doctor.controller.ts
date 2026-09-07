require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import doctorModel from "../models/doctor.model";
import clinicModel from "../models/clinic.model";

// ── Create Doctor Profile ──────────────────────────────────────────────────────
export const createDoctorProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;

      const existing = await doctorModel.findOne({ userId });
      if (existing) {
        return next(
          new ErrorHandler("Doctor profile already exists", 400),
        );
      }

      const {
        specialization,
        subSpecialization,
        bio,
        yearsOfExperience,
        consultationFee,
        services,
        certificates, // array of base64 strings or URLs
      } = req.body;

      if (!specialization) {
        return next(
          new ErrorHandler("Please enter your specialization", 400),
        );
      }

      // Upload certificates to Cloudinary
      const uploadedCertificates: string[] = [];
      if (certificates && Array.isArray(certificates)) {
        for (const cert of certificates) {
          const result = await cloudinary.v2.uploader.upload(cert, {
            folder: "doctor-certificates",
          });
          uploadedCertificates.push(result.secure_url);
        }
      }

      const doctor = await doctorModel.create({
        userId,
        specialization,
        subSpecialization,
        bio,
        yearsOfExperience,
        consultationFee,
        services: services || [],
        certificates: uploadedCertificates,
      });

      res.status(201).json({ success: true, doctor });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Update Doctor Profile ──────────────────────────────────────────────────────
export const updateDoctorProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel.findOne({ userId });

      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      const {
        specialization,
        subSpecialization,
        bio,
        yearsOfExperience,
        consultationFee,
        services,
        newCertificates, // new base64 strings to upload
      } = req.body;

      if (specialization) doctor.specialization = specialization;
      if (subSpecialization !== undefined)
        doctor.subSpecialization = subSpecialization;
      if (bio !== undefined) doctor.bio = bio;
      if (yearsOfExperience !== undefined)
        doctor.yearsOfExperience = yearsOfExperience;
      if (consultationFee !== undefined)
        doctor.consultationFee = consultationFee;
      if (services !== undefined)
        doctor.services = services;

      // Upload and append new certificates
      if (newCertificates && Array.isArray(newCertificates)) {
        for (const cert of newCertificates) {
          const result = await cloudinary.v2.uploader.upload(cert, {
            folder: "doctor-certificates",
          });
          doctor.certificates.push(result.secure_url);
        }
      }

      await doctor.save();
      res.status(200).json({ success: true, doctor });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get My Doctor Profile ─────────────────────────────────────────────────────
export const getMyDoctorProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user._id;
      const doctor = await doctorModel
        .findOne({ userId })
        .populate("userId", "name email avatar")
        .populate("clinics");

      if (!doctor) {
        return next(new ErrorHandler("Doctor profile not found", 404));
      }

      res.status(200).json({ success: true, doctor });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get Doctor Profile by ID ──────────────────────────────────────────────────
export const getDoctorProfile = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await doctorModel
        .findById(req.params.id)
        .populate("userId", "name email avatar")
        .populate("clinics");

      if (!doctor) {
        return next(new ErrorHandler("Doctor not found", 404));
      }

      res.status(200).json({ success: true, doctor });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Get All Approved Doctors ──────────────────────────────────────────────────
export const getAllDoctors = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        specialization,
        search,
        governorate,
        minPrice,
        maxPrice,
        minRating,
        sortBy,
        page = 1,
        limit = 10,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      // ── Step 1: If governorate filter, get matching clinic doctorIds ──────────
      let governorateDoctorIds: any[] | null = null;
      if (governorate) {
        const matchingClinics = await clinicModel.find({
          "address.governorate": {
            $regex: new RegExp(governorate as string, "i"),
          },
        });
        governorateDoctorIds = matchingClinics.map((c) => c.doctorId);
      }

      // ── Step 2: Build aggregation pipeline ────────────────────────────────────
      const pipeline: any[] = [
        // Join with users to enable name search
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userInfo",
          },
        },
        { $unwind: "$userInfo" },

        // Join with clinics for location data
        {
          $lookup: {
            from: "clinics",
            localField: "_id",
            foreignField: "doctorId",
            as: "clinicDetails",
          },
        },

        // ── Filters ─────────────────────────────────────────────────────────────
        {
          $match: {
            isApproved: true,
            ...(specialization && {
              specialization: {
                $regex: new RegExp(specialization as string, "i"),
              },
            }),
            ...(search && {
              $or: [
                {
                  "userInfo.name": {
                    $regex: new RegExp(search as string, "i"),
                  },
                },
                {
                  specialization: {
                    $regex: new RegExp(search as string, "i"),
                  },
                },
              ],
            }),
            ...(governorateDoctorIds && {
              _id: { $in: governorateDoctorIds },
            }),
            ...(minPrice !== undefined && {
              consultationFee: { $gte: Number(minPrice) },
            }),
            ...(maxPrice !== undefined && {
              consultationFee: { $lte: Number(maxPrice) },
            }),
            ...(minRating !== undefined && {
              rating: { $gte: Number(minRating) },
            }),
          },
        },

        // ── Sort ─────────────────────────────────────────────────────────────────
        {
          $sort:
            sortBy === "fee_asc"
              ? { consultationFee: 1 }
              : sortBy === "fee_desc"
              ? { consultationFee: -1 }
              : { rating: -1 }, // default: best rating first
        },
      ];

      // Count total before pagination
      const countPipeline = [...pipeline, { $count: "total" }];
      const countResult = await doctorModel.aggregate(countPipeline);
      const total = countResult[0]?.total ?? 0;

      // Paginate
      pipeline.push({ $skip: skip }, { $limit: Number(limit) });

      // Project final shape
      pipeline.push({
        $project: {
          _id: 1,
          specialization: 1,
          subSpecialization: 1,
          bio: 1,
          yearsOfExperience: 1,
          consultationFee: 1,
          services: 1,
          rating: 1,
          reviewsCount: 1,
          isApproved: 1,
          certificates: 1,
          clinics: "$clinicDetails",
          userId: {
            _id: "$userInfo._id",
            name: "$userInfo.name",
            email: "$userInfo.email",
            avatar: "$userInfo.avatar",
          },
        },
      });

      const doctors = await doctorModel.aggregate(pipeline);

      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        doctors,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);


// ── Admin: Verify Doctor ──────────────────────────────────────────────────────
export const verifyDoctor = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await doctorModel.findById(req.params.id);

      if (!doctor) {
        return next(new ErrorHandler("Doctor not found", 404));
      }

      doctor.isApproved = true;
      await doctor.save();

      res.status(200).json({
        success: true,
        message: "Doctor verified successfully",
        doctor,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ── Admin: Revoke Doctor Verification ─────────────────────────────────────────
export const revokeDoctor = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doctor = await doctorModel.findById(req.params.id);

      if (!doctor) {
        return next(new ErrorHandler("Doctor not found", 404));
      }

      doctor.isApproved = false;
      await doctor.save();

      res.status(200).json({
        success: true,
        message: "Doctor verification revoked",
        doctor,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
