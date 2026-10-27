
const express = require("express");
const mongoose = require("mongoose");

const Application = require("../models/application");
const Project = require("../models/project");
const Opportunity = require("../models/opportunity");
const User = require("../models/user");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// All application routes require authentication.
router.use(authenticateToken);

/* =========================================================
   COMPANY OPPORTUNITY APPLICATION ROUTES
========================================================= */

// 1. Individual applies to a company opportunity.
router.post("/opportunity/:opportunityId", async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { message, resumeUrl = "" } = req.body;
    const userId = String(req.user.userId);

    if (!mongoose.isValidObjectId(opportunityId)) {
      return res.status(400).json({
        message: "Invalid opportunity ID.",
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 20 ||
      message.trim().length > 1000
    ) {
      return res.status(400).json({
        message: "Application message must be 20–1000 characters.",
      });
    }

    if (
      typeof resumeUrl !== "string" ||
      resumeUrl.trim().length > 2000
    ) {
      return res.status(400).json({
        message: "Invalid resume URL.",
      });
    }

    const [opportunity, applicant] = await Promise.all([
      Opportunity.findById(opportunityId),
      User.findById(userId).select("name email role"),
    ]);

    if (!opportunity) {
      return res.status(404).json({
        message: "Opportunity not found.",
      });
    }

    if (
      opportunity.status !== "published" ||
      (opportunity.deadline &&
        new Date(opportunity.deadline) < new Date())
    ) {
      return res.status(400).json({
        message: "This opportunity is not accepting applications.",
      });
    }

    if (!applicant || applicant.role !== "individual") {
      return res.status(403).json({
        message: "Only individual accounts can apply.",
      });
    }

    if (String(opportunity.company) === userId) {
      return res.status(403).json({
        message: "You cannot apply to your own opportunity.",
      });
    }

    // Resume links must use HTTPS.
    if (resumeUrl.trim()) {
      let parsedUrl;

      try {
        parsedUrl = new URL(resumeUrl.trim());
      } catch {
        return res.status(400).json({
          message: "Invalid resume URL.",
        });
      }

      if (parsedUrl.protocol !== "https:") {
        return res.status(400).json({
          message: "Resume URL must use HTTPS.",
        });
      }
    }

    const application = await Application.create({
      opportunity: opportunity._id,
      applicant: applicant._id,
      message: message.trim(),
      resumeUrl: resumeUrl.trim(),
      status: "pending",
    });

    return res.status(201).json({
      message: "Application submitted successfully.",
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already applied to this opportunity.",
      });
    }

    console.error("Opportunity application error:", error);

    return res.status(500).json({
      message: "Unable to submit application.",
    });
  }
});

// 2. Company retrieves applicants for one of its opportunities.
router.get("/opportunity/:opportunityId", async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const userId = String(req.user.userId);

    if (!mongoose.isValidObjectId(opportunityId)) {
      return res.status(400).json({
        message: "Invalid opportunity ID.",
      });
    }

    const opportunity = await Opportunity.findById(opportunityId);

    if (!opportunity) {
      return res.status(404).json({
        message: "Opportunity not found.",
      });
    }

    if (String(opportunity.company) !== userId) {
      return res.status(403).json({
        message: "Only the owning company can view these applicants.",
      });
    }

    const applications = await Application.find({
      opportunity: opportunity._id,
    })
      .populate("applicant", "name email role bio avatar")
      .populate("opportunity", "title type status")
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Opportunity applicants error:", error);

    return res.status(500).json({
      message: "Unable to fetch opportunity applicants.",
    });
  }
});

// 3. Company retrieves applicants across all its opportunities.
router.get("/company/opportunities", async (req, res) => {
  try {
    const company = await User.findById(req.user.userId).select("role");

    if (!company || company.role !== "company") {
      return res.status(403).json({
        message: "Only company accounts can view applicants.",
      });
    }

    const opportunities = await Opportunity.find({
      company: company._id,
    }).select("_id");

    const opportunityIds = opportunities.map(
      (opportunity) => opportunity._id
    );

    const applications = await Application.find({
      opportunity: { $in: opportunityIds },
    })
      .populate("applicant", "name email role bio avatar")
      .populate("opportunity", "title type status")
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Company applicants error:", error);

    return res.status(500).json({
      message: "Unable to fetch applicants.",
    });
  }
});

// 4. Individual retrieves only their opportunity applications.
router.get("/my-opportunities", async (req, res) => {
  try {
    const applications = await Application.find({
      applicant: req.user.userId,
      opportunity: { $ne: null },
    })
      .populate("opportunity", "title type status company")
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("My opportunity applications error:", error);

    return res.status(500).json({
      message: "Unable to fetch your applications.",
    });
  }
});

// 5. Company shortlists, accepts, or rejects an applicant.
router.patch(
  "/opportunity/application/:applicationId/status",
  async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status } = req.body;
      const userId = String(req.user.userId);

      if (!mongoose.isValidObjectId(applicationId)) {
        return res.status(400).json({
          message: "Invalid application ID.",
        });
      }

      if (!["shortlisted", "accepted", "rejected"].includes(status)) {
        return res.status(400).json({
          message: "Invalid application status.",
        });
      }

      const application = await Application.findOne({
        _id: applicationId,
        opportunity: { $ne: null },
      });

      if (!application) {
        return res.status(404).json({
          message: "Opportunity application not found.",
        });
      }

      const opportunity = await Opportunity.findOne({
        _id: application.opportunity,
        company: userId,
      });

      if (!opportunity) {
        return res.status(403).json({
          message: "You cannot manage applicants for this opportunity.",
        });
      }

      application.status = status;
      await application.save();

      return res.status(200).json({
        message: `Application ${status}.`,
        application,
      });
    } catch (error) {
      console.error("Update opportunity application status error:", error);

      return res.status(500).json({
        message: "Unable to update application status.",
      });
    }
  }
);

/* =========================================================
   PROJECT COLLABORATION APPLICATION ROUTES
========================================================= */

// 6. Individual applies to a project.
router.post("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { message } = req.body;
    const userId = String(req.user.userId);

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID.",
      });
    }

    if (
      typeof message !== "string" ||
      message.trim().length < 20 ||
      message.trim().length > 1000
    ) {
      return res.status(400).json({
        message: "Application message must be 20–1000 characters.",
      });
    }

    const project = await Project.findById(projectId);

    if (!project || project.status !== "active") {
      return res.status(404).json({
        message: "Active project not found.",
      });
    }

    if (project.openToCollaborators === false) {
      return res.status(400).json({
        message: "This project is not accepting applications.",
      });
    }

    if (String(project.owner) === userId) {
      return res.status(403).json({
        message: "You cannot apply to your own project.",
      });
    }

    const applicant = await User.findById(userId).select("role");

    if (!applicant || applicant.role !== "individual") {
      return res.status(403).json({
        message: "Only individual accounts can apply to projects.",
      });
    }

    const application = await Application.create({
      project: project._id,
      applicant: userId,
      message: message.trim(),
      status: "pending",
    });

    return res.status(201).json({
      message: "Application submitted successfully.",
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already applied to this project.",
      });
    }

    console.error("Submit project application error:", error);

    return res.status(500).json({
      message: "Unable to submit application.",
    });
  }
});

// 7. Logged-in user retrieves all their applications.
router.get("/my", async (req, res) => {
  try {
    const applications = await Application.find({
      applicant: req.user.userId,
    })
      .populate("project", "title description status owner")
      .populate("opportunity", "title type status company")
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("My applications error:", error);

    return res.status(500).json({
      message: "Unable to fetch your applications.",
    });
  }
});

// 8. Project owner retrieves applications for their project.
router.get("/project/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    if (String(project.owner) !== String(req.user.userId)) {
      return res.status(403).json({
        message: "Only the project owner can view these applications.",
      });
    }

    const applications = await Application.find({
      project: projectId,
    })
      .populate("applicant", "name email role bio avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({ applications });
  } catch (error) {
    console.error("Project applications error:", error);

    return res.status(500).json({
      message: "Unable to fetch project applications.",
    });
  }
});

// 9. Project owner accepts or rejects a pending application.
router.patch("/:applicationId/status", async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const userId = String(req.user.userId);

    if (!mongoose.isValidObjectId(applicationId)) {
      return res.status(400).json({
        message: "Invalid application ID.",
      });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be accepted or rejected.",
      });
    }

    const application = await Application.findOne({
      _id: applicationId,
      project: { $ne: null },
    });

    if (!application) {
      return res.status(404).json({
        message: "Project application not found.",
      });
    }

    const project = await Project.findById(application.project);

    if (!project) {
      return res.status(404).json({
        message: "Associated project not found.",
      });
    }

    if (String(project.owner) !== userId) {
      return res.status(403).json({
        message: "Only the project owner can update this application.",
      });
    }

    if (application.status !== "pending") {
      return res.status(409).json({
        message: "This application has already been reviewed.",
        status: application.status,
      });
    }

    application.status = status;
    await application.save();

    return res.status(200).json({
      message:
        status === "rejected"
          ? "Collaboration request rejected successfully."
          : "Collaboration request accepted successfully.",
      application: {
        _id: application._id,
        project: application.project,
        applicant: application.applicant,
        message: application.message,
        status: application.status,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      },
    });
  } catch (error) {
    console.error("Review project application error:", error);

    return res.status(500).json({
      message: "Unable to update application status.",
    });
  }
});

// 10. Owner or accepted collaborator fetches project workspace.
router.get("/workspace/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = String(req.user.userId);

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findById(projectId).populate(
      "owner",
      "name email role avatar"
    );

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    const ownerId = project.owner?._id
      ? String(project.owner._id)
      : String(project.owner);

    const isOwner = ownerId === userId;

    const acceptedApplication = await Application.exists({
      project: project._id,
      applicant: userId,
      status: "accepted",
    });

    if (!isOwner && !acceptedApplication) {
      return res.status(403).json({
        message:
          "Only the project owner and accepted collaborators can access this workspace.",
      });
    }

    const acceptedApplications = await Application.find({
      project: project._id,
      status: "accepted",
    })
      .populate("applicant", "name email role bio avatar")
      .sort({ createdAt: 1 });

    const collaborators = acceptedApplications
      .filter((application) => application.applicant)
      .map((application) => ({
        ...application.applicant.toObject(),
        joinedAt: application.createdAt,
      }));

    return res.status(200).json({
      project,
      collaborators,
      access: isOwner ? "owner" : "collaborator",
    });
  } catch (error) {
    console.error("Workspace fetch error:", error);

    return res.status(500).json({
      message: "Unable to load project workspace.",
    });
  }
});

/* =========================================================
   11. COMPANY RECORDS PAYMENT FOR AN ACCEPTED APPLICANT
   ========================================================= */

   router.patch(
    "/opportunity/application/:applicationId/payment",
    async (req, res) => {
      try {
        const { applicationId } = req.params;
        const { amount, method, transactionReference } = req.body;
        const userId = String(req.user.userId);
  
        if (!mongoose.isValidObjectId(applicationId)) {
          return res.status(400).json({
            message: "Invalid application ID.",
          });
        }
  
        const numericAmount = Number(amount);
  
        if (
          amount === undefined ||
          amount === null ||
          amount === "" ||
          !Number.isFinite(numericAmount) ||
          numericAmount <= 0 ||
          !Number.isSafeInteger(Math.round(numericAmount * 100))
        ) {
          return res.status(400).json({
            message: "Enter a valid payment amount greater than zero.",
          });
        }
  
        if (!["upi", "bank_transfer"].includes(method)) {
          return res.status(400).json({
            message: "Choose UPI or bank transfer.",
          });
        }
  
        const reference = String(transactionReference || "").trim();
  
        if (!reference || reference.length > 100) {
          return res.status(400).json({
            message: "Enter a valid UPI transaction reference or bank UTR.",
          });
        }
  
        const company = await User.findById(userId).select("role");
  
        if (!company || company.role !== "company") {
          return res.status(403).json({
            message: "Only company accounts can record payments.",
          });
        }
  
        const application = await Application.findOne({
          _id: applicationId,
          opportunity: { $ne: null },
        });
  
        if (!application) {
          return res.status(404).json({
            message: "Opportunity application not found.",
          });
        }
  
        if (application.status !== "accepted") {
          return res.status(400).json({
            message: "Only accepted collaborators can be paid.",
          });
        }
  
        const opportunity = await Opportunity.findOne({
          _id: application.opportunity,
          company: company._id,
        });
  
        if (!opportunity) {
          return res.status(403).json({
            message: "You cannot pay applicants for another company's opportunity.",
          });
        }
  
        if (application.payment?.status === "paid") {
          return res.status(409).json({
            message: "Payment has already been recorded for this application.",
          });
        }
  
        application.payment = {
          amount: Math.round(numericAmount * 100) / 100,
          currency: "INR",
          status: "paid",
          method,
          transactionReference: reference,
          paidAt: new Date(),
          recordedBy: company._id,
        };
  
        await application.save();
  
        return res.status(200).json({
          message: "Payment recorded successfully.",
          application,
        });
      } catch (error) {
        console.error("Record collaborator payment error:", error);
  
        return res.status(500).json({
          message: "Unable to record collaborator payment.",
        });
      }
    }
  );
  
module.exports = router;
