
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 3000,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    rolesNeeded: {
      type: [String],
      default: [],
    },

    experience: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },

    githubUrl: {
      type: String,
      trim: true,
      default: "",
    },

    githubVisibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    thumbnail: {
      type: String,
      default: "",
    },

    openToCollaborators: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
