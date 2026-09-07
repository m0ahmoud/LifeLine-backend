import express, { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import {
  activateUser,
  deleteUser,
  getAllUsers,
  getUserInfo,
  loginUser,
  logoutUser,
  registrationUser,
  socialAuth,
  updateAccessToken,
  updatePassword,
  updateProfilePicture,
  updateUserInfo,
  updateUserRole,
  addDependent,
  removeDependent,
  confirmPasswordReset,
  requestPasswordReset,
} from "../controllers/user.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
const userRoute = express.Router();

const validateRegistration = [
  body("name").notEmpty().withMessage("Name is required").trim().escape(),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

userRoute.post("/registration", validateRegistration, registrationUser);

userRoute.post("/activate-user", activateUser);

userRoute.post("/login", loginUser);

userRoute.post("/logout", isAuthenticated, logoutUser);

userRoute.get("/refresh", updateAccessToken, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: true,
    accessToken: (req as any).accessToken,
    user: req.user,
  });
});

userRoute.get("/me", isAuthenticated, getUserInfo);

userRoute.post("/social-auth", socialAuth);

userRoute.put("/update-user-info", isAuthenticated, updateUserInfo);

userRoute.put("/update-user-password", isAuthenticated, updatePassword);

userRoute.put("/update-user-avatar", isAuthenticated, updateProfilePicture);

userRoute.post("/dependents", isAuthenticated, addDependent);

userRoute.delete("/dependents/:dependentId", isAuthenticated, removeDependent);

userRoute.get(
  "/get-users",
  isAuthenticated,
  authorizeRoles("admin"),
  getAllUsers,
);

userRoute.put(
  "/update-user",
  isAuthenticated,
  authorizeRoles("admin"),
  updateUserRole,
);

userRoute.delete(
  "/delete-user/:id",
  isAuthenticated,
  authorizeRoles("admin"),
  deleteUser,
);

userRoute.post("/password-reset", requestPasswordReset);
userRoute.post("/password-reset/confirm", confirmPasswordReset);

export default userRoute;
