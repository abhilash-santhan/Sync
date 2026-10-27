
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Message = require("../models/message");
const Project = require("../models/project");
const Application = require("../models/application");
const authenticateToken = require("../middleware/auth");

router.use(authenticateToken);

async function hasProjectAccess(projectId, userId) {
  if (
    !mongoose.isValidObjectId(projectId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    return false;
  }

  const project = await Project.findById(projectId).select("owner");

  if (!project) return false;

  if (String(project.owner) === String(userId)) {
    return true;
  }

  const application = await Application.exists({
    project: projectId,
    applicant: userId,
    status: "accepted",
  });

  return Boolean(application);
}

// GET: Load project chat history
router.get("/:projectId", async (req, res) => {
  try {
    const allowed = await hasProjectAccess(
      req.params.projectId,
      req.user.userId
    );

    if (!allowed) {
      return res.status(403).json({
        message: "You are not authorized to access this project chat.",
      });
    }

    const messages = await Message.find({
      project: req.params.projectId,
    })
      .populate("sender", "name")
      .sort({ createdAt: 1 })
      .limit(200);

    return res.json({ messages });
  } catch (error) {
    console.error("Load chat error:", error);

    return res.status(500).json({
      message: "Could not load chat messages.",
    });
  }
});

// POST: Send a project chat message
router.post("/:projectId", async (req, res) => {
  try {
    const { text } = req.body;

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        message: "Please enter a message.",
      });
    }

    if (text.trim().length > 2000) {
      return res.status(400).json({
        message: "Messages cannot exceed 2000 characters.",
      });
    }

    const allowed = await hasProjectAccess(
      req.params.projectId,
      req.user.userId
    );

    if (!allowed) {
      return res.status(403).json({
        message:
          "Only the project owner and accepted collaborators can chat.",
      });
    }

    const message = await Message.create({
      project: req.params.projectId,
      sender: req.user.userId,
      text: text.trim(),
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name");

    return res.status(201).json({
      message: populatedMessage,
    });
  } catch (error) {
    console.error("Send chat message error:", error);

    return res.status(500).json({
      message: "Could not send the message.",
    });
  }
});

module.exports = router;
