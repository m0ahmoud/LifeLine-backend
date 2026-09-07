import { Request,Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import jwt,{JwtPayload} from "jsonwebtoken";
import { redis } from "../utils/redis";

export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
        if (req.user) {
            return next();
        }
        const token = req.cookies.access_token;
        if (!token) {
            return next(new ErrorHandler('Please login to access this resource', 401));
        }
        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN as string) as JwtPayload;
            const user = await redis.get(decoded._id);
            if (!user) {
                return next(new ErrorHandler('Please login to access this resource', 401));
            }
            req.user = JSON.parse(user);
            next();
        } catch (err: any) {
            // Return 401 so the client interceptor can trigger a refresh
            return next(new ErrorHandler('Access token expired or invalid', 401));
        }
})

export const authorizeRoles = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.user.role || '')) {
            return next(new ErrorHandler('You are not allowed to access this resource', 403))
        }
        next()
    }
}