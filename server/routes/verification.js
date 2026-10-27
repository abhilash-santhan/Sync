
const express = require("express");
const User = require("../models/user");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

const allowedStatuses = [
  "not_submitted",
  "pending",
  "under_review",
  "needs_more_info",
  "verified",
  "rejected",
  "suspended",
];

// GET /api/verification/status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "role companyVerification"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "company") {
      return res.status(403).json({
        message: "Company accounts only",
      });
    }

    return res.status(200).json({
      verification: user.companyVerification,
    });
  } catch (error) {
    console.error("Verification status error:", error.message);
    return res.status(500).json({
      message: "Unable to fetch verification status",
    });
  }
});

// POST /api/verification/submit
router.post("/submit", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "company") {
      return res.status(403).json({
        message: "Only company accounts can submit verification",
      });
    }

    const {
      legalBusinessName,
      country,
      registrationNumber,
      website,
      businessEmail,
      representativeName,
      representativeRole,
      evidenceUrls,
    } = req.body;

    const requiredFields = {
      legalBusinessName,
      country,
      businessEmail,
      representativeName,
      representativeRole,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (typeof value !== "string" || !value.trim()) {
        return res.status(400).json({
          message: `${field} is required`,
        });
      }
    }

    if (
      legalBusinessName.trim().length > 150 ||
      country.trim().length > 100 ||
      businessEmail.trim().length > 254 ||
      representativeName.trim().length > 100 ||
      representativeRole.trim().length > 100
    ) {
      return res.status(400).json({
        message: "One or more fields exceed the allowed length",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(businessEmail.trim())) {
      return res.status(400).json({
        message: "Enter a valid business email address",
      });
    }

    if (website && typeof website !== "string") {
      return res.status(400).json({ message: "Invalid website" });
    }

    if (registrationNumber && typeof registrationNumber !== "string") {
      return res.status(400).json({
        message: "Invalid registration number",
      });
    }

    if (website?.trim()) {
      let parsedWebsite;

      try {
        parsedWebsite = new URL(website.trim());
      } catch {
        return res.status(400).json({
          message: "Website must be a valid URL",
        });
      }

      if (
        !["http:", "https:"].includes(parsedWebsite.protocol)
      ) {
        return res.status(400).json({
          message: "Website must use HTTP or HTTPS",
        });
      }
    }

    if (
      evidenceUrls !== undefined &&
      (!Array.isArray(evidenceUrls) ||
        evidenceUrls.length > 5 ||
        evidenceUrls.some(
          (url) =>
            typeof url !== "string" ||
            !url.startsWith("https://")
        ))
    ) {
      return res.status(400).json({
        message: "Evidence must contain up to 5 HTTPS URLs",
      });
    }

    const verification = user.companyVerification;

    if (verification.status === "verified") {
      return res.status(409).json({
        message: "This company is already verified",
      });
    }

    if (verification.status === "suspended") {
      return res.status(403).json({
        message: "This company's verification is suspended",
      });
    }

    if (
      ["pending", "under_review"].includes(verification.status)
    ) {
      return res.status(409).json({
        message: "Your verification application is already being reviewed",
      });
    }

    verification.legalBusinessName = legalBusinessName.trim();
    verification.country = country.trim();
    verification.registrationNumber =
      typeof registrationNumber === "string"
        ? registrationNumber.trim()
        : "";
    verification.website =
      typeof website === "string" ? website.trim() : "";
    verification.businessEmail = businessEmail.trim().toLowerCase();
    verification.representativeName = representativeName.trim();
    verification.representativeRole = representativeRole.trim();
    verification.evidenceUrls = evidenceUrls || [];
    verification.status = "pending";
    verification.submittedAt = new Date();
    verification.reviewedAt = null;
    verification.reviewedBy = null;
    verification.reviewNote = "";

    await user.save();

    return res.status(201).json({
      message: "Verification application submitted successfully",
      verification: {
        status: verification.status,
        submittedAt: verification.submittedAt,
      },
    });
  } catch (error) {
    console.error("Verification submission error:", error.message);
    return res.status(500).json({
      message: "Unable to submit verification application",
    });
  }
});

module.exports = router;
