
const mongoose = require("mongoose");

const companyVerificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "not_submitted",
        "pending",
        "under_review",
        "needs_more_info",
        "verified",
        "rejected",
        "suspended",
      ],
      default: "not_submitted",
    },

    legalBusinessName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "India",
    },

    registrationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    businessEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    representativeName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    representativeRole: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    evidenceUrls: {
      type: [String],
      default: [],
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["individual", "company"],
      default: "individual",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    avatar: {
      type: String,
      default: "",
    },
    following: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    companyVerification: {
      type: companyVerificationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
