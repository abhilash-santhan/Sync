
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Project = require("../models/project");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "../uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${require("crypto").randomUUID()}${extension}`);
  },
});

const uploadThumbnail = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new Error("Use a JPG, PNG, WEBP, or GIF image."));
    }
    callback(null, true);
  },
});

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({ status: "active" })
      .populate("owner", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Fetch projects error:", error.message);
    return res.status(500).json({ message: "Unable to fetch projects" });
  }
});

router.post(
  "/",
  authenticateToken,
  (req, res, next) => {
    uploadThumbnail.single("thumbnail")(req, res, (error) => {
      if (error) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Thumbnail must be 5 MB or smaller."
            : error.message || "Unable to upload thumbnail.";

        return res.status(400).json({ message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const {
        title,
        description,
        tags,
        rolesNeeded,
        experience,
        githubUrl,
        githubVisibility,
        openToCollaborators,
      } = req.body;

      if (
        typeof title !== "string" ||
        title.trim().length < 3 ||
        title.trim().length > 100
      ) {
        return res.status(400).json({
          message: "Title must be between 3 and 100 characters",
        });
      }

      if (
        typeof description !== "string" ||
        description.trim().length < 10 ||
        description.trim().length > 3000
      ) {
        return res.status(400).json({
          message: "Description must be between 10 and 3000 characters",
        });
      }

      let parsedTags = [];
      let parsedRoles = [];

      try {
        parsedTags = tags ? JSON.parse(tags) : [];
        parsedRoles = rolesNeeded ? JSON.parse(rolesNeeded) : [];
      } catch {
        return res.status(400).json({
          message: "Tags and roles must be valid lists",
        });
      }

      if (
        !Array.isArray(parsedTags) ||
        !parsedTags.every((tag) => typeof tag === "string") ||
        !Array.isArray(parsedRoles) ||
        !parsedRoles.every((role) => typeof role === "string")
      ) {
        return res.status(400).json({
          message: "Tags and roles must be lists of text",
        });
      }

      const selectedExperience = experience || "Beginner";
      const validExperiences = ["Beginner", "Intermediate", "Advanced"];

      if (!validExperiences.includes(selectedExperience)) {
        return res.status(400).json({ message: "Invalid experience level" });
      }

      const selectedVisibility = githubVisibility || "private";
      const validVisibility = ["public", "private", "shared"];

      if (!validVisibility.includes(selectedVisibility)) {
        return res.status(400).json({ message: "Invalid GitHub visibility" });
      }

      const normalizedGithubUrl = githubUrl?.trim() || "";

      if (normalizedGithubUrl) {
        let parsedUrl;

        try {
          parsedUrl = new URL(normalizedGithubUrl);
        } catch {
          return res.status(400).json({ message: "Invalid GitHub URL" });
        }

        if (
          parsedUrl.protocol !== "https:" ||
          !["github.com", "www.github.com"].includes(parsedUrl.hostname)
        ) {
          return res.status(400).json({
            message: "GitHub URL must use https://github.com/",
          });
        }
      }

      let collaboratorSetting = true;

      if (openToCollaborators !== undefined) {
        if (!["true", "false"].includes(openToCollaborators)) {
          return res.status(400).json({
            message: "openToCollaborators must be true or false",
          });
        }

        collaboratorSetting = openToCollaborators === "true";
      }

      const thumbnailUrl = req.file
        ? `/uploads/${req.file.filename}`
        : "";

      const project = await Project.create({
        title: title.trim(),
        description: description.trim(),
        owner: new mongoose.Types.ObjectId(req.user.userId),
        tags: parsedTags.map((tag) => tag.trim()).filter(Boolean),
        rolesNeeded: parsedRoles.map((role) => role.trim()).filter(Boolean),
        experience: selectedExperience,
        githubUrl: normalizedGithubUrl,
        githubVisibility: selectedVisibility,
        thumbnail: thumbnailUrl,
        openToCollaborators: collaboratorSetting,
      });

      await project.populate("owner", "name role");

      return res.status(201).json({
        message: "Project published successfully",
        project,
      });
    } catch (error) {
      console.error("Create project error:", error.message);
      return res.status(500).json({ message: "Unable to publish project" });
    }
  }
);

router.delete("/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid project ID",
        });
      }
  
      const project = await Project.findById(id);
  
      if (!project) {
        return res.status(404).json({
          message: "Project not found",
        });
      }
  
      // Only the project owner can delete it.
      const userId = req.user.userId;
  
      if (!userId || project.owner.toString() !== userId.toString()) {
        return res.status(403).json({
          message: "You are not authorized to delete this project",
        });
      }
  
      // Remove the uploaded thumbnail, if one exists.
      if (project.thumbnail && project.thumbnail.startsWith("/uploads/")) {
        const filename = path.basename(project.thumbnail);
        const thumbnailPath = path.join(uploadDirectory, filename);
  
        try {
          await fs.promises.unlink(thumbnailPath);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.error("Thumbnail cleanup error:", error.message);
          }
        }
      }
  
      await Project.findByIdAndDelete(id);
  
      return res.status(200).json({
        message: "Project deleted successfully",
      });
    } catch (error) {
      console.error("Delete project error:", error.message);
  
      return res.status(500).json({
        message: "Unable to delete project",
      });
    }
  });
  

module.exports = router;
