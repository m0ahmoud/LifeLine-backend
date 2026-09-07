require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";

interface ITokenOptions {
  expires: Date;
  httpOnly: boolean;
  secure?: boolean;
  sameSite: "lax" | "strict" | "none" | undefined;
  maxAge: number;
  partitioned?: boolean;
}

const accessTokenExpire = parseInt(
  (process.env.ACCESS_TOKEN_EXPIRE as string) || "5",
);
const refreshTokenExpire = parseInt(
  (process.env.REFRESH_TOKEN_EXPIRE as string) || "3",
);

// ✅ دالة تقرأ NODE_ENV في وقت الاستدعاء وليس وقت التحميل
const getIsProduction = () => process.env.NODE_ENV === "production";

export const getAccessTokenOptions = (): ITokenOptions => ({
  expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
  httpOnly: true,
  sameSite: getIsProduction() ? "none" : "lax",
  secure: getIsProduction(),
  maxAge: accessTokenExpire * 60 * 60 * 1000,
  partitioned: getIsProduction(),
});

export const getRefreshTokenOptions = (): ITokenOptions => ({
  expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
  httpOnly: true,
  sameSite: getIsProduction() ? "none" : "lax",
  secure: getIsProduction(),
  maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
  partitioned: getIsProduction(),
});

export const getRoleCookieOptions = (): ITokenOptions => ({
  expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
  httpOnly: false, // Frontend JS needs to read it
  sameSite: getIsProduction() ? "none" : "lax",
  secure: getIsProduction(),
  maxAge: accessTokenExpire * 60 * 60 * 1000,
  partitioned: getIsProduction(),
});

// ✅ الاحتفاظ بالـ exports القديمة للتوافق مع الكود الموجود
export const accessTokenOptions: ITokenOptions = getAccessTokenOptions();
export const refreshTokenOptions: ITokenOptions = getRefreshTokenOptions();

export const sentToken = (user: IUser, statusCodes: number, res: Response) => {
  const accessToken = user.SignAccessToken();
  const refreshToken = user.SignRefreshToken();

  // ✅ حفظ في Redis لمدة 7 أيام
  redis.set(user._id.toString(), JSON.stringify(user), "EX", 604800);

  // ✅ إرسال الـ cookies مع options محدّثة في وقت الاستدعاء
  res.cookie("access_token", accessToken, getAccessTokenOptions());
  res.cookie("refresh_token", refreshToken, getRefreshTokenOptions());
  res.cookie("role", user.role, getRoleCookieOptions());

  res.status(statusCodes).json({
    success: true,
    accessToken,
    user,
  });
};
