require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncError";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendEmail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sentToken,
  getAccessTokenOptions,
  getRefreshTokenOptions,
  getRoleCookieOptions,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.service";
import cloudinary from "cloudinary";
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password }: IRegistrationBody = req.body;
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email already exist", 500));
      }
      const user: IRegistrationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);
      const activationCode = activationToken.activationCode;
      const data = {
        user: { name: user.name, email: user.email },
        activationCode,
      };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation.mail.ejs"),
        data,
      );
      try {
        await sendEmail({
          email: user.email,
          subject: "Activate Your Account",
          template: "activation.mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: "User registered successfully",
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    },
  );
  return { token, activationCode };
};

interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}
// activate user
export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_code, activation_token } =
        req.body as IActivationRequest;
      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string,
      ) as { user: IUser; activationCode: string };
      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }
      const { name, email, password } = newUser.user;
      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler("User already exist", 400));
      }
      const user = await userModel.create({
        name,
        email,
        password,
        isVerified: true,
      });
      res.status(201).json({ success: true });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// login user
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 500));
      }
      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 500));
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return next(new ErrorHandler("Invalid email or password", 500));
      }
      sentToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", {
        ...getAccessTokenOptions(),
        maxAge: 0,
        expires: new Date(0),
      });
      res.cookie("refresh_token", "", {
        ...getRefreshTokenOptions(),
        maxAge: 0,
        expires: new Date(0),
      });
      res.cookie("role", "", {
        ...getRoleCookieOptions(),
        maxAge: 0,
        expires: new Date(0),
      });
      const userId = req.user._id;
      redis.del(userId.toString());
      res.status(200).json({ success: true, message: "Logout successfully" });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// update access token
export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.cookies.refresh_token as string;

      console.log("REFRESH TOKEN RECEIVED:", refresh_token ? "YES" : "NO");

      if (!refresh_token) {
        return next(new ErrorHandler("Refresh token not found", 401));
      }
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refresh_token,
          process.env.REFRESH_TOKEN as string,
        ) as JwtPayload;
        console.log("REFRESH TOKEN DECODED:", decoded);
      } catch (err: any) {
        console.log("JWT VERIFY ERROR:", err.message);
        return next(new ErrorHandler("Refresh token expired or invalid", 401));
      }

      if (!decoded) {
        return next(new ErrorHandler("Could not refresh token", 401));
      }
      const user = await redis.get(decoded._id);
      if (!user) {
        return next(
          new ErrorHandler("please login to access this resource!", 500),
        );
      }
      const session = JSON.parse(user);
      const accessToken = jwt.sign(
        { _id: session._id },
        (process.env.ACCESS_TOKEN as string) || "",
        { expiresIn: "5m" },
      );
      const refreshToken = jwt.sign(
        { _id: session._id },
        (process.env.REFRESH_TOKEN as string) || "",
        { expiresIn: "3d" },
      );
      req.user = session;
      (req as any).accessToken = accessToken;
      res.cookie("access_token", accessToken, getAccessTokenOptions());
      res.cookie("refresh_token", refreshToken, getRefreshTokenOptions());
      res.cookie("role", session.role, getRoleCookieOptions());
      await redis.set(
        session._id.toString(),
        JSON.stringify(session),
        "EX",
        604800,
      );
      next();
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user?._id;
      getUserById(user, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

interface ISocialAuthRequest {
  name: string;
  email: string;
  avatar: object;
}

// social auth
export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, avatar } = req.body as ISocialAuthRequest;
      const user = await userModel.findOne({ email });
      if (user) {
        sentToken(user, 200, res);
      } else {
        const newUser = await userModel.create({
          name,
          email,
          avatar:
            typeof avatar === "string"
              ? { public_id: "", url: avatar }
              : avatar,
        });
        sentToken(newUser, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// update user info
interface IUpdateUserRequest {
  name: string;
  email: string;
  avatar: object;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as IUpdateUserRequest;
      const userId = req.user._id;
      const user = await userModel.findById(userId);

      if (name && user) {
        user.name = name;
      }
      await user?.save();
      await redis.set(userId.toString(), JSON.stringify(user));
      res.status(200).json({ success: true, user });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// update user password
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;
      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 500));
      }
      const userId = req.user._id;
      const user = await userModel.findById(userId).select("+password");
      if (!user?.password) {
        return next(new ErrorHandler("invalid user", 500));
      }
      const isPasswordMatch = await user?.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 500));
      }
      user.password = newPassword;
      await user.save();
      await redis.set(userId.toString(), JSON.stringify(user));
      res.status(200).json({ success: true, user });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

interface IUpdateProfilePicture {
  avatar: object;
}
// update profile picture
export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body;
      const userId = req.user._id;
      const user = await userModel.findById(userId);
      if (avatar && user) {
        if (user?.avatar?.public_id) {
          await cloudinary.v2.uploader.destroy(user.avatar?.public_id);
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }
      await user?.save();
      await redis.set(userId.toString(), JSON.stringify(user));
      res.status(200).json({ success: true, user });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// get all users admin
export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// update user role admin
export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;
      updateUserRoleService(res, id, role);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// delete user admin
export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);
      if (!user) {
        return next(new ErrorHandler("User not found", 500));
      }
      await user.deleteOne({ id });
      await redis.del(id);
      res
        .status(200)
        .json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// Add a dependent
export const addDependent = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, relation, dob, gender } = req.body;
      const userId = req.user._id;

      if (!name || !relation) {
        return next(new ErrorHandler("Name and relation are required", 400));
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      const newDependent = {
        name,
        relation,
        dob: dob ? new Date(dob) : undefined,
        gender,
      };

      user.dependents.push(newDependent as any);
      await user.save();
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(201).json({ success: true, user });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// Remove a dependent
export const removeDependent = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dependentId } = req.params;
      const userId = req.user._id;

      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      user.dependents = user.dependents.filter(
        (dep: any) => dep._id.toString() !== dependentId,
      ) as any;

      await user.save();
      await redis.set(userId.toString(), JSON.stringify(user));

      res.status(200).json({ success: true, user });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============ Password Reset ============

interface IPasswordResetRequest {
  email: string;
  locale?: string; // "en" | "ar"
}

interface IPasswordResetToken {
  token: string;
}

export const createPasswordResetToken = (
  userId: string,
): IPasswordResetToken => {
  const token = jwt.sign(
    { userId },
    process.env.PASSWORD_RESET_SECRET as Secret,
    { expiresIn: "15m" },
  );
  return { token };
};

// request password reset - sends email with reset link/token

export const requestPasswordReset = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, locale } = req.body as IPasswordResetRequest;

      if (!email) {
        return next(new ErrorHandler("Please enter your email", 400));
      }

      // whitelist اللغات المسموحة، وبديل افتراضي لو مبعوتش أو غلط
      const allowedLocales = ["en", "ar"];
      const safeLocale = allowedLocales.includes(locale || "") ? locale : "en";

      const user = await userModel.findOne({ email });

      if (!user) {
        return res.status(200).json({ status: "success" });
      }

      const { token } = createPasswordResetToken(user._id.toString());

      const resetUrl = `${process.env.ORIGIN}/${safeLocale}/reset-password?token=${token}`;

      const isArabic = safeLocale === "ar";
      const data = {
        user: { name: user.name },
        resetUrl,
        isArabic,
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/password-reset.mail.ejs"),
        data,
      );

      try {
        await sendEmail({
          email: user.email,
          subject: isArabic ? "إعادة تعيين كلمة المرور" : "Reset Your Password",
          template: "password-reset.mail.ejs",
          data,
        });

        res.status(200).json({ status: "success" });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);

// confirm password reset - verifies token and sets new password
interface IPasswordResetConfirmRequest {
  token: string;
  password: string;
}

export const confirmPasswordReset = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body as IPasswordResetConfirmRequest;

      if (!token || !password) {
        return next(new ErrorHandler("Token and password are required", 400));
      }

      if (password.length < 6) {
        return next(
          new ErrorHandler("Password must be at least 6 characters", 400),
        );
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          token,
          process.env.PASSWORD_RESET_SECRET as string,
        ) as JwtPayload;
      } catch (err: any) {
        return next(
          new ErrorHandler("Reset link is invalid or has expired", 400),
        );
      }

      const user = await userModel.findById(decoded.userId).select("+password");
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      user.password = password;
      await user.save();
      await redis.set(user._id.toString(), JSON.stringify(user));

      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  },
);
