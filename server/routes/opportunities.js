const express = require("express");
const mongoose = require("mongoose");
const Opportunity = require("../models/opportunity");
const User = require("../models/user");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

const validTypes = ["job", "internship", "project"];
const validStatuses = ["draft", "published", "closed"];
const validWorkModes = ["Remote", "On-site", "Hybrid"];
const validEmploymentTypes = [
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
  "Project-based",
];
const validExperienceLevels = [
  "Entry-level",
  "Intermediate",
  "Experienced",
  "Any",
];

const getCompany = async (userId) => {
  const user = await User.findById(userId).select(
    "role companyVerification"
  );

  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  if (user.role !== "company") {
    return {
      error: {
        status: 403,
        message: "Only company accounts can manage opportunities",
      },
    };
  }

  return { user };
};

const isVerified = (user) =>
  user.companyVerification?.status === "verified";

const validateOpportunity = (body, isUpdate = false) => {
  const errors = [];

  if (!isUpdate || body.type !== undefined) {
    if (!validTypes.includes(body.type)) {
      errors.push("Type must be job, internship, or project");
    }
  }

  if (!isUpdate || body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      body.title.trim().length < 3 ||
      body.title.trim().length > 120
    ) {
      errors.push("Title must be between 3 and 120 characters");
    }
  }

  if (!isUpdate || body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      body.description.trim().length < 20 ||
      body.description.trim().length > 5000
    ) {
      errors.push(
        "Description must be between 20 and 5000 characters"
      );
    }
  }

  if (body.skills !== undefined) {
    if (
      !Array.isArray(body.skills) ||
      !body.skills.every(
        (skill) =>
          typeof skill === "string" && skill.trim().length <= 50
      ) ||
      body.skills.length > 30
    ) {
      errors.push("Skills must be a list of up to 30 text values");
    }
  }

  if (
    body.workMode !== undefined &&
    !validWorkModes.includes(body.workMode)
  ) {
    errors.push("Invalid work mode");
  }

  if (
    body.employmentType !== undefined &&
    !validEmploymentTypes.includes(body.employmentType)
  ) {
    errors.push("Invalid employment type");
  }

  if (
    body.experienceLevel !== undefined &&
    !validExperienceLevels.includes(body.experienceLevel)
  ) {
    errors.push("Invalid experience level");
  }

  for (const field of ["salaryMin", "salaryMax"]) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      (typeof body[field] !== "number" ||
        !Number.isFinite(body[field]) ||
        body[field] < 0)
    ) {
      errors.push(`${field} must be a non-negative number`);
    }
  }

  if (
    body.salaryMin != null &&
    body.salaryMax != null &&
    body.salaryMin > body.salaryMax
  ) {
    errors.push("Minimum salary cannot exceed maximum salary");
  }

  for (const field of ["location", "currency"]) {
    if (
      body[field] !== undefined &&
      (typeof body[field] !== "string" ||
        body[field].trim().length > (field === "location" ? 150 : 10))
    ) {
      errors.push(`Invalid ${field}`);
    }
  }

  for (const field of ["applicationUrl", "applicationEmail"]) {
    if (
      body[field] !== undefined &&
      typeof body[field] !== "string"
    ) {
      errors.push(`Invalid ${field}`);
    }
  }

  if (body.applicationUrl) {
    try {
      const url = new URL(body.applicationUrl);

      if (url.protocol !== "https:") {
        errors.push("Application URL must use HTTPS");
      }
    } catch {
      errors.push("Application URL must be a valid URL");
    }
  }

  if (body.applicationEmail) {
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.applicationEmail)
    ) {
      errors.push("Application email is invalid");
    }
  }

  if (body.deadline !== undefined && body.deadline !== null) {
    const deadline = new Date(body.deadline);

    if (Number.isNaN(deadline.getTime())) {
      errors.push("Deadline must be a valid date");
    }
  }

  if (
    body.status !== undefined &&
    !validStatuses.includes(body.status)
  ) {
    errors.push("Status must be draft, published, or closed");
  }

  return errors;
};

const editableFields = [
  "type",
  "title",
  "description",
  "skills",
  "location",
  "workMode",
  "employmentType",
  "experienceLevel",
  "salaryMin",
  "salaryMax",
  "currency",
  "applicationUrl",
  "applicationEmail",
  "deadline",
];

// PUBLIC: GET /api/opportunities
// Only published opportunities from verified companies are visible.
router.get("/", async (req, res) => {
  try {
    const opportunities = await Opportunity.find({
      status: "published",
    })
      .populate({
        path: "company",
        select: "name role companyVerification.status",
        match: {
          role: "company",
          "companyVerification.status": "verified",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const visibleOpportunities = opportunities.filter(
      (item) => item.company
    );

    return res.status(200).json({
      opportunities: visibleOpportunities,
    });
  } catch (error) {
    console.error("Fetch opportunities error:", error.message);

    return res.status(500).json({
      message: "Unable to fetch opportunities",
    });
  }
});

// AUTHENTICATED COMPANY: GET /api/opportunities/mine
// Includes the company's own drafts, published posts, and closed posts.
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const result = await getCompany(req.user.userId);

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    const opportunities = await Opportunity.find({
      company: result.user._id,
    }).sort({ updatedAt: -1 });

    return res.status(200).json({
      opportunities,
      verificationStatus:
        result.user.companyVerification?.status || "not_submitted",
    });
  } catch (error) {
    console.error("Fetch company opportunities error:", error.message);

    return res.status(500).json({
      message: "Unable to fetch your opportunities",
    });
  }
});

// CREATE: POST /api/opportunities
router.post("/", authenticateToken, async (req, res) => {
  try {
    const result = await getCompany(req.user.userId);

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    const errors = validateOpportunity(req.body);

    if (errors.length) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    const requestedStatus = req.body.status || "draft";

    if (requestedStatus === "published" && !isVerified(result.user)) {
      return res.status(403).json({
        message:
          "Your company must be verified before publishing opportunities",
        verificationStatus:
          result.user.companyVerification?.status || "not_submitted",
      });
    }

    const opportunityData = {};

    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        opportunityData[field] = req.body[field];
      }
    }

    if (opportunityData.title) {
      opportunityData.title = opportunityData.title.trim();
    }

    if (opportunityData.description) {
      opportunityData.description = opportunityData.description.trim();
    }

    if (opportunityData.skills) {
      opportunityData.skills = opportunityData.skills
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    if (opportunityData.location) {
      opportunityData.location = opportunityData.location.trim();
    }

    if (opportunityData.currency) {
      opportunityData.currency = opportunityData.currency
        .trim()
        .toUpperCase();
    }

    if (opportunityData.applicationEmail) {
      opportunityData.applicationEmail =
        opportunityData.applicationEmail.trim().toLowerCase();
    }

    if (opportunityData.applicationUrl) {
      opportunityData.applicationUrl =
        opportunityData.applicationUrl.trim();
    }

    if (opportunityData.deadline) {
      opportunityData.deadline = new Date(opportunityData.deadline);
    }

    const opportunity = await Opportunity.create({
      ...opportunityData,
      company: result.user._id,
      status: requestedStatus,
    });

    return res.status(201).json({
      message:
        requestedStatus === "published"
          ? "Opportunity published successfully"
          : "Opportunity draft saved successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Create opportunity error:", error.message);

    return res.status(500).json({
      message: "Unable to create opportunity",
    });
  }
});

// UPDATE: PATCH /api/opportunities/:id
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid opportunity ID",
      });
    }

    const result = await getCompany(req.user.userId);

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    const opportunity = await Opportunity.findOne({
      _id: req.params.id,
      company: result.user._id,
    });

    if (!opportunity) {
      return res.status(404).json({
        message: "Opportunity not found",
      });
    }

    const allowedFields = [...editableFields, "status"];
    const invalidFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (invalidFields.length) {
      return res.status(400).json({
        message: `Fields cannot be updated: ${invalidFields.join(", ")}`,
      });
    }

    const errors = validateOpportunity(req.body, true);

    if (errors.length) {
      return res.status(400).json({
        message: errors[0],
        errors,
      });
    }

    if (
      req.body.status === "published" &&
      !isVerified(result.user)
    ) {
      return res.status(403).json({
        message:
          "Your company must be verified before publishing opportunities",
        verificationStatus:
          result.user.companyVerification?.status || "not_submitted",
      });
    }

    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        opportunity[field] = req.body[field];
      }
    }

    if (req.body.title !== undefined) {
      opportunity.title = req.body.title.trim();
    }

    if (req.body.description !== undefined) {
      opportunity.description = req.body.description.trim();
    }

    if (req.body.skills !== undefined) {
      opportunity.skills = req.body.skills
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    if (req.body.location !== undefined) {
      opportunity.location = req.body.location.trim();
    }

    if (req.body.currency !== undefined) {
      opportunity.currency = req.body.currency.trim().toUpperCase();
    }

    if (req.body.applicationEmail !== undefined) {
      opportunity.applicationEmail =
        req.body.applicationEmail.trim().toLowerCase();
    }

    if (req.body.applicationUrl !== undefined) {
      opportunity.applicationUrl = req.body.applicationUrl.trim();
    }

    if (req.body.deadline !== undefined) {
      opportunity.deadline = req.body.deadline
        ? new Date(req.body.deadline)
        : null;
    }

    if (req.body.status !== undefined) {
      opportunity.status = req.body.status;
    }

    await opportunity.save();

    return res.status(200).json({
      message: "Opportunity updated successfully",
      opportunity,
    });
  } catch (error) {
    console.error("Update opportunity error:", error.message);

    return res.status(500).json({
      message: "Unable to update opportunity",
    });
  }
});

// DELETE: DELETE /api/opportunities/:id
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid opportunity ID",
      });
    }

    const result = await getCompany(req.user.userId);

    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }

    const opportunity = await Opportunity.findOneAndDelete({
      _id: req.params.id,
      company: result.user._id,
    });

    if (!opportunity) {
      return res.status(404).json({
        message: "Opportunity not found",
      });
    }

    return res.status(200).json({
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error("Delete opportunity error:", error.message);

    return res.status(500).json({
      message: "Unable to delete opportunity",
    });
  }
});

module.exports = router;