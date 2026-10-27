
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const authenticateAdmin = require("../middleware/adminAuth");

const router = express.Router();

function createAdminToken() {
  return jwt.sign(
    {
      adminId: "sync-admin",
      role: "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (
    !process.env.ADMIN_EMAIL ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.JWT_SECRET
  ) {
    return res.status(500).json({
      message: "Admin authentication is not configured",
    });
  }

  const emailMatches =
    typeof email === "string" &&
    email.trim().toLowerCase() ===
      process.env.ADMIN_EMAIL.trim().toLowerCase();

  const passwordMatches =
    typeof password === "string" &&
    password === process.env.ADMIN_PASSWORD;

  if (!emailMatches || !passwordMatches) {
    return res.status(401).json({
      message: "Invalid admin credentials",
    });
  }

  return res.status(200).json({
    message: "Admin login successful",
    token: createAdminToken(),
    admin: {
      email: process.env.ADMIN_EMAIL,
      role: "admin",
    },
  });
});

// GET /api/admin/applications?status=pending
router.get("/applications", authenticateAdmin, async (req, res) => {
  try {
    const allowedStatuses = [
      "pending",
      "under_review",
      "needs_more_info",
      "verified",
      "rejected",
      "suspended",
    ];

    const status = req.query.status || "pending";

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid verification status",
      });
    }

    const companies = await User.find({
      role: "company",
      "companyVerification.status": status,
    })
      .select("name email companyVerification createdAt")
      .sort({ "companyVerification.submittedAt": 1 });

    return res.status(200).json({ applications: companies });
  } catch (error) {
    console.error("Admin applications error:", error.message);
    return res.status(500).json({
      message: "Unable to fetch applications",
    });
  }
});

// PATCH /api/admin/applications/:userId/review
router.patch(
  "/applications/:userId/review",
  authenticateAdmin,
  async (req, res) => {
    try {
      const { action, note } = req.body;

      const allowedActions = [
        "approve",
        "reject",
        "request_more_info",
      ];

      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          message: "Invalid review action",
        });
      }

      if (
        note !== undefined &&
        (typeof note !== "string" || note.length > 2000)
      ) {
        return res.status(400).json({
          message: "Review note must be a string of up to 2000 characters",
        });
      }

      const company = await User.findOne({
        _id: req.params.userId,
        role: "company",
      });

      if (!company) {
        return res.status(404).json({
          message: "Company account not found",
        });
      }

      const verification = company.companyVerification;

      if (
        ["not_submitted", "suspended"].includes(verification.status)
      ) {
        return res.status(409).json({
          message: "This application cannot be reviewed in its current state",
        });
      }

      const statusByAction = {
        approve: "verified",
        reject: "rejected",
        request_more_info: "needs_more_info",
      };

      verification.status = statusByAction[action];
      verification.reviewedAt = new Date();
      verification.reviewedBy = null;
      verification.reviewNote = note?.trim() || "";

      await company.save();

      return res.status(200).json({
        message: "Company application reviewed successfully",
        application: {
          userId: company._id,
          status: verification.status,
          reviewedAt: verification.reviewedAt,
          reviewNote: verification.reviewNote,
        },
      });
    } catch (error) {
      console.error("Admin review error:", error.message);
      return res.status(500).json({
        message: "Unable to review company application",
      });
    }
  }
);

module.exports = router;
