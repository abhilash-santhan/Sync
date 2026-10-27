
const express = require("express");
const mongoose = require("mongoose");

const Task = require("../models/task");
const Project = require("../models/project");
const Application = require("../models/application");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

// Check whether the user owns the project or is an accepted collaborator.
async function getAccess(projectId, userId) {
  if (!mongoose.isValidObjectId(projectId)) return null;

  const project = await Project.findById(projectId);
  if (!project) return null;

  const isOwner = String(project.owner) === String(userId);

  const isCollaborator =
    !isOwner &&
    Boolean(
      await Application.exists({
        project: project._id,
        applicant: userId,
        status: "accepted",
      })
    );

  if (!isOwner && !isCollaborator) return null;

  return { project, isOwner };
}

// GET: Fetch project tasks for owner or accepted collaborators.
router.get("/:projectId", async (req, res) => {
  try {
    const access = await getAccess(
      req.params.projectId,
      req.user.userId
    );

    if (!access) {
      return res.status(403).json({
        message: "Project not found or access denied.",
      });
    }

    const tasks = await Task.find({
      project: access.project._id,
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    return res.json({ tasks });
  } catch (error) {
    console.error("Fetch tasks error:", error.message);

    return res.status(500).json({
      message: "Unable to fetch tasks.",
    });
  }
});

// POST: Only the project owner can create tasks.
router.post("/:projectId", async (req, res) => {
  try {
    const access = await getAccess(
      req.params.projectId,
      req.user.userId
    );

    if (!access) {
      return res.status(403).json({
        message: "Project not found or access denied.",
      });
    }

    if (!access.isOwner) {
      return res.status(403).json({
        message: "Only the project owner can create tasks.",
      });
    }

    const {
      title,
      description = "",
      assignedTo = null,
      dueDate = null,
    } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length < 3 ||
      title.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Title must be between 3 and 100 characters.",
      });
    }

    if (
      typeof description !== "string" ||
      description.length > 1000
    ) {
      return res.status(400).json({
        message: "Invalid description.",
      });
    }

    if (
      dueDate !== null &&
      (typeof dueDate !== "string" ||
        !Number.isFinite(Date.parse(dueDate)))
    ) {
      return res.status(400).json({
        message: "Invalid due date.",
      });
    }

    if (assignedTo !== null) {
      if (!mongoose.isValidObjectId(assignedTo)) {
        return res.status(400).json({
          message: "Invalid assignee.",
        });
      }

      const isOwner =
        String(access.project.owner) === String(assignedTo);

      const isAcceptedCollaborator =
        !isOwner &&
        Boolean(
          await Application.exists({
            project: access.project._id,
            applicant: assignedTo,
            status: "accepted",
          })
        );

      if (!isOwner && !isAcceptedCollaborator) {
        return res.status(400).json({
          message:
            "Assignee must be the owner or an accepted collaborator.",
        });
      }
    }

    const task = await Task.create({
      project: access.project._id,
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.user.userId,
    });

    await task.populate("assignedTo", "name email");
    await task.populate("createdBy", "name");

    return res.status(201).json({
      message: "Task created successfully.",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error.message);

    return res.status(500).json({
      message: "Unable to create task.",
    });
  }
});

// PATCH: Owner and accepted collaborators can update task status.
router.patch("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    if (!["Todo", "In Progress", "Completed"].includes(status)) {
      return res.status(400).json({
        message: "Status must be Todo, In Progress, or Completed.",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    const access = await getAccess(
      task.project,
      req.user.userId
    );

    if (!access) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    task.status = status;
    await task.save();

    await task.populate("assignedTo", "name email");
    await task.populate("createdBy", "name");

    return res.json({
      message: "Task status updated successfully.",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error.message);

    return res.status(500).json({
      message: "Unable to update task.",
    });
  }
});

module.exports = router;
