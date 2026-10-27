const mongoose = require("mongoose");

const opportunitySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["job", "internship", "project"],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 5000,
    },

    skills: {
      type: [String],
      default: [],
    },

    location: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "Remote",
    },

    workMode: {
      type: String,
      enum: ["Remote", "On-site", "Hybrid"],
      default: "Remote",
    },

    employmentType: {
      type: String,
      enum: [
        "Full-time",
        "Part-time",
        "Internship",
        "Contract",
        "Project-based",
      ],
      default: "Full-time",
    },

    experienceLevel: {
      type: String,
      enum: ["Entry-level", "Intermediate", "Experienced", "Any"],
      default: "Entry-level",
    },

    salaryMin: {
      type: Number,
      min: 0,
      default: null,
    },

    salaryMax: {
      type: Number,
      min: 0,
      default: null,
    },

    currency: {
      type: String,
      trim: true,
      default: "INR",
    },

    applicationUrl: {
      type: String,
      trim: true,
      default: "",
    },

    applicationEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    deadline: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

opportunitySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Opportunity", opportunitySchema);