
const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },

    opportunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
      index: true,
    },

    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 1000,
    },

    resumeUrl: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "shortlisted", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    payment: {
        amount: {
          type: Number,
          min: 0,
          default: null,
        },
        currency: {
          type: String,
          enum: ["INR"],
          default: "INR",
        },
        status: {
          type: String,
          enum: ["unpaid", "paid"],
          default: "unpaid",
        },
        method: {
          type: String,
          enum: ["upi", "bank_transfer"],
          default: "upi",
        },
        transactionReference: {
          type: String,
          trim: true,
          maxlength: 100,
          default: "",
        },
        paidAt: {
          type: Date,
          default: null,
        },
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
  },
  {
    timestamps: true,
  }
);

// An application must target exactly one project or opportunity.
applicationSchema.pre("validate", function () {
  const hasProject = Boolean(this.project);
  const hasOpportunity = Boolean(this.opportunity);

  if (hasProject === hasOpportunity) {
    throw new Error(
      "An application must target exactly one project or opportunity."
    );
  }
});

// Prevent duplicate applications to the same project.
applicationSchema.index(
  { project: 1, applicant: 1 },
  {
    unique: true,
    partialFilterExpression: {
      project: { $type: "objectId" },
    },
  }
);

// Prevent duplicate applications to the same opportunity.
applicationSchema.index(
  { opportunity: 1, applicant: 1 },
  {
    unique: true,
    partialFilterExpression: {
      opportunity: { $type: "objectId" },
    },
  }
);

module.exports = mongoose.model("Application", applicationSchema);
