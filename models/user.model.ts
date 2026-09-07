require("dotenv").config();
import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const emailRegexPattern: RegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface IDependent {
  name: string;
  relation: "child" | "parent" | "spouse" | "sibling" | "other";
  dob?: Date;
  gender?: "male" | "female";
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    avatar: {
        public_id: string;
        url: string;
    };
    role: string;
    isVerified: boolean;
    isBlocked: boolean;
    courses: Array<{ courseId: string }>;
    dependents: IDependent[];
    comparePassword(password: string): Promise<boolean>;
    SignAccessToken(): string;
    SignRefreshToken(): string;
}

const userSchema = new Schema<IUser>({
    name: {
        type: String,
        required: [true, "Please enter your name"],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: (value: string) => emailRegexPattern.test(value),
            message: "Please enter a valid email",
        },
    },
    password: {
        type: String,
        minLength: [8, "Password should be longer than 8 characters"],
        select: false,
    },
    avatar: {
        public_id: String,
        url: String,
    },
    role: {
        type: String,
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    courses: [
        {
            courseId: String,
        },
    ],
    dependents: [
        {
            name: { type: String, required: true },
            relation: { type: String, enum: ["child", "parent", "spouse", "sibling", "other"], required: true },
            dob: { type: Date },
            gender: { type: String, enum: ["male", "female"] }
        }
    ]
}, {
    timestamps: true,
});
// hash password before save
userSchema.pre<IUser>("save", async function (this: IUser) {
    if (!this.isModified("password")) {
        return;
    }
    if (!this.password) {
        return;
    }

    try {
        this.password = await bcrypt.hash(this.password, 10);
    } catch (error: any) {
        throw error;
    }
});
//sign access token
userSchema.methods.SignAccessToken = function (): string {
    return jwt.sign({ _id: this._id }, process.env.ACCESS_TOKEN as string || '',{expiresIn: '5m'});
};
//sign refresh token
userSchema.methods.SignRefreshToken = function (): string {
    return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN as string || '',{expiresIn: '3d'});
}
// compare password
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(password, this.password);
}
const userModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default userModel;