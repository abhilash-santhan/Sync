
import React, { useEffect, useState } from "react";
import "./CompanyDashboard.css";

const API = "http://localhost:3001/api/verification";
const APPLICATIONS_API = "http://localhost:3001/api/applications";
const OPPORTUNITIES_API = "http://localhost:3001/api/opportunities";

const STATUS_INFO = {
  not_submitted: {
    label: "Not submitted",
    title: "Verify your business",
    description: "Complete your company profile and submit your evidence for review.",
  },
  pending: {
    label: "Pending",
    title: "Application submitted",
    description: "Your application is waiting for administrator review.",
  },
  under_review: {
    label: "Under review",
    title: "Your application is being reviewed",
    description: "Our team is checking your business details and evidence.",
  },
  needs_more_info: {
    label: "Action required",
    title: "More information required",
    description: "Review the administrator's feedback and update your application.",
  },
  verified: {
    label: "Verified",
    title: "Your company is verified",
    description: "Your company has been approved to publish opportunities.",
  },
  rejected: {
    label: "Rejected",
    title: "Application needs attention",
    description: "Review the administrator's feedback before submitting again.",
  },
  suspended: {
    label: "Suspended",
    title: "Publishing suspended",
    description: "Contact support for information about your company status.",
  },
};

const EMPTY_FORM = {
  legalBusinessName: "",
  country: "India",
  registrationNumber: "",
  website: "",
  businessEmail: "",
  representativeName: "",
  representativeRole: "",
  evidenceUrls: "",
};

const EMPTY_OPPORTUNITY = {
  type: "internship",
  title: "",
  description: "",
  skills: "",
  location: "Remote",
  workMode: "Remote",
  employmentType: "Internship",
  experienceLevel: "Entry-level",
  salaryMin: "",
  salaryMax: "",
  applicationUrl: "",
  applicationEmail: "",
  deadline: "",
  status: "draft",
};

export default function CompanyDashboard() {
  const [verification, setVerification] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunitySubmitting, setOpportunitySubmitting] = useState(false);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [opportunityError, setOpportunityError] = useState("");
  const [opportunityMessage, setOpportunityMessage] = useState("");
  const [opportunityForm, setOpportunityForm] = useState({ ...EMPTY_OPPORTUNITY });

  // Opportunity applications submitted by candidates to this company.
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState("");
  const [reviewingApplicationId, setReviewingApplicationId] = useState(null);
  const [paymentAmounts, setPaymentAmounts] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [paymentReferences, setPaymentReferences] = useState({});
  const [recordingPaymentId, setRecordingPaymentId] = useState(null);

  const token = sessionStorage.getItem("syncToken");
  const user = JSON.parse(sessionStorage.getItem("syncUser") || "{}");
  const status = verification?.status || "not_submitted";
  const statusInfo = STATUS_INFO[status] || STATUS_INFO.not_submitted;
  const verified = status === "verified";
  const canSubmit = [
    "not_submitted",
    "needs_more_info",
    "rejected",
  ].includes(status);

  async function loadVerification() {
    if (!token) {
      window.location.href = "/";
      return;
    }

    try {
      setError("");

      const response = await fetch(`${API}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load verification status.");
      }

      const record =
        data.verification ?? data.companyVerification ?? data;

      setVerification(record);

      setForm((previous) => ({
        ...previous,
        legalBusinessName: record.legalBusinessName || "",
        country: record.country || "India",
        registrationNumber: record.registrationNumber || "",
        website: record.website || "",
        businessEmail: record.businessEmail || "",
        representativeName: record.representativeName || "",
        representativeRole: record.representativeRole || "",
        evidenceUrls: (record.evidenceUrls || []).join("\n"),
      }));
    } catch (err) {
      setError(err.message || "Unable to connect to SYNC.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOpportunities() {
    if (!token) {
      setOpportunityError("Your session has expired. Please log in again.");
      setOpportunitiesLoading(false);
      return;
    }

    setOpportunitiesLoading(true);
    setOpportunityError("");

    try {
      const response = await fetch(`${OPPORTUNITIES_API}/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Unable to load opportunities (HTTP ${response.status}).`);
      }

      setOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
    } catch (err) {
      setOpportunityError(err.message || "Unable to load your opportunities.");
    } finally {
      setOpportunitiesLoading(false);
    }
  }

  function updateOpportunityField(event) {
    const { name, value } = event.target;
    setOpportunityForm((previous) => ({ ...previous, [name]: value }));
  }

  function resetOpportunityForm() {
    setOpportunityForm({ ...EMPTY_OPPORTUNITY });
    setEditingOpportunityId(null);
    setShowOpportunityForm(false);
  }

  function editOpportunity(opportunity) {
    setEditingOpportunityId(opportunity._id);
    setOpportunityForm({
      type: opportunity.type || "internship",
      title: opportunity.title || "",
      description: opportunity.description || "",
      skills: Array.isArray(opportunity.skills) ? opportunity.skills.join(", ") : (opportunity.skills || ""),
      location: opportunity.location || "Remote",
      workMode: opportunity.workMode || "Remote",
      employmentType: opportunity.employmentType || "Internship",
      experienceLevel: opportunity.experienceLevel || "Entry-level",
      salaryMin: opportunity.salaryMin ?? "",
      salaryMax: opportunity.salaryMax ?? "",
      applicationUrl: opportunity.applicationUrl || "",
      applicationEmail: opportunity.applicationEmail || "",
      deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString().slice(0, 10) : "",
      status: opportunity.status || "draft",
    });
    setOpportunityError("");
    setOpportunityMessage("");
    setShowOpportunityForm(true);
  }

  async function saveOpportunity(event) {
    event.preventDefault();
    setOpportunityError("");
    setOpportunityMessage("");

    if (!token) {
      setOpportunityError("Your session has expired. Please log in again.");
      return;
    }

    if (!verified && opportunityForm.status === "published") {
      setOpportunityError("Your company must be verified before publishing.");
      return;
    }

    if (opportunityForm.salaryMin !== "" && Number(opportunityForm.salaryMin) < 0) {
      setOpportunityError("Minimum compensation cannot be negative.");
      return;
    }
    if (opportunityForm.salaryMax !== "" && Number(opportunityForm.salaryMax) < 0) {
      setOpportunityError("Maximum compensation cannot be negative.");
      return;
    }
    if (opportunityForm.salaryMin !== "" && opportunityForm.salaryMax !== "" && Number(opportunityForm.salaryMin) > Number(opportunityForm.salaryMax)) {
      setOpportunityError("Minimum compensation cannot exceed maximum compensation.");
      return;
    }

    const payload = {
      ...opportunityForm,
      title: opportunityForm.title.trim(),
      description: opportunityForm.description.trim(),
      skills: opportunityForm.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      salaryMin: opportunityForm.salaryMin === "" ? null : Number(opportunityForm.salaryMin),
      salaryMax: opportunityForm.salaryMax === "" ? null : Number(opportunityForm.salaryMax),
      deadline: opportunityForm.deadline || null,
    };

    setOpportunitySubmitting(true);
    try {
      const url = editingOpportunityId
        ? `${OPPORTUNITIES_API}/${encodeURIComponent(editingOpportunityId)}`
        : OPPORTUNITIES_API;
      const response = await fetch(url, {
        method: editingOpportunityId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `Unable to save opportunity (HTTP ${response.status}).`);
      }

      setOpportunityMessage(data.message || "Opportunity saved successfully.");
      resetOpportunityForm();
      await loadOpportunities();
    } catch (err) {
      setOpportunityError(err.message || "Unable to save opportunity.");
    } finally {
      setOpportunitySubmitting(false);
    }
  }

  async function changeOpportunityStatus(opportunity, nextStatus) {
    setOpportunityError("");
    setOpportunityMessage("");
    if (nextStatus === "published" && !verified) {
      setOpportunityError("Your company must be verified before publishing.");
      return;
    }

    try {
      const response = await fetch(`${OPPORTUNITIES_API}/${encodeURIComponent(opportunity._id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Unable to update status (HTTP ${response.status}).`);
      setOpportunityMessage(data.message || `Opportunity ${nextStatus}.`);
      await loadOpportunities();
    } catch (err) {
      setOpportunityError(err.message || "Unable to update opportunity status.");
    }
  }

  async function deleteOpportunity(opportunity) {
    if (!window.confirm(`Delete \"${opportunity.title}\" permanently?`)) return;
    setOpportunityError("");
    setOpportunityMessage("");
    try {
      const response = await fetch(`${OPPORTUNITIES_API}/${encodeURIComponent(opportunity._id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Unable to delete opportunity (HTTP ${response.status}).`);
      setOpportunityMessage(data.message || "Opportunity deleted.");
      await Promise.all([loadOpportunities(), loadOpportunityApplications()]);
    } catch (err) {
      setOpportunityError(err.message || "Unable to delete opportunity.");
    }
  }

  async function loadOpportunityApplications() {
    if (!token) {
      setApplicationsError("Your session has expired. Please log in again.");
      return;
    }

    try {
      setApplicationsLoading(true);
      setApplicationsError("");

      const response = await fetch(`${APPLICATIONS_API}/company/opportunities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to load applicants (HTTP ${response.status}).`
        );
      }

      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (err) {
      setApplicationsError(
        err.message || "Unable to load applicants. Check that the backend route is enabled."
      );
    } finally {
      setApplicationsLoading(false);
    }
  }

  async function reviewOpportunityApplication(applicationId, status) {
    if (!["accepted", "rejected"].includes(status)) return;

    if (!token) {
      setApplicationsError("Your session has expired. Please log in again.");
      return;
    }

    try {
      setReviewingApplicationId(applicationId);
      setApplicationsError("");

      const response = await fetch(
        `${APPLICATIONS_API}/opportunity/application/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Unable to update applicant status (HTTP ${response.status}).`
        );
      }

      setApplications((current) =>
        current.map((application) =>
          String(application._id) === String(applicationId)
            ? { ...application, status: data.application?.status || status }
            : application
        )
      );
      setMessage(`Candidate ${status} successfully.`);
    } catch (err) {
      setApplicationsError(err.message || "Unable to update applicant status.");
    } finally {
      setReviewingApplicationId(null);
    }
  }

  function updatePaymentField(setter, applicationId, value) {
    setter((current) => ({ ...current, [applicationId]: value }));
  }

  async function recordCollaboratorPayment(application) {
    const applicationId = String(application._id);
    const amount = Number(paymentAmounts[applicationId]);
    const method = paymentMethods[applicationId] || "upi";
    const transactionReference = (paymentReferences[applicationId] || "").trim();

    if (application.status !== "accepted") {
      setApplicationsError("Only accepted collaborators can be paid.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      setApplicationsError("Enter a valid payment amount between ₹1 and ₹1,00,00,000.");
      return;
    }
    if (transactionReference.length < 4 || transactionReference.length > 100) {
      setApplicationsError("Enter the UPI reference, UTR, or bank transaction reference (4–100 characters).");
      return;
    }

    const confirmed = window.confirm(
      `Confirm that you have already transferred ₹${amount.toLocaleString("en-IN")} to ${application.applicant?.name || "this collaborator"}?`
    );
    if (!confirmed) return;

    try {
      setRecordingPaymentId(applicationId);
      setApplicationsError("");
      const response = await fetch(
        `${APPLICATIONS_API}/opportunity/application/${encodeURIComponent(applicationId)}/payment`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ amount, method, transactionReference }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || `Unable to record payment (HTTP ${response.status}).`);
      }
      setApplications((current) => current.map((item) =>
        String(item._id) === applicationId
          ? { ...item, payment: data.application?.payment || data.payment }
          : item
      ));
      setMessage("Payment record saved. SYNC has not transferred the money itself.");
    } catch (err) {
      setApplicationsError(err.message || "Unable to record payment.");
    } finally {
      setRecordingPaymentId(null);
    }
  }

  useEffect(() => {
    if (user.role !== "company") {
      window.location.href = user.role === "individual" ? "/dashboard" : "/";
      return;
    }

    loadVerification();
    loadOpportunities();
    loadOpportunityApplications();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function selectFiles(event) {
    const selected = Array.from(event.target.files || []);
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];
    const maxSize = 5 * 1024 * 1024;

    const invalidFile = selected.find(
      (file) => !allowedTypes.includes(file.type) || file.size > maxSize
    );

    if (invalidFile) {
      setMessage("Choose PDF, JPG, or PNG files up to 5 MB each.");
      event.target.value = "";
      return;
    }

    setMessage("");
    setFiles((previous) => {
      const combined = [...previous, ...selected];
      return combined.filter(
        (file, index) =>
          combined.findIndex(
            (item) => item.name === file.name && item.size === file.size
          ) === index
      );
    });

    event.target.value = "";
  }

  function removeFile(indexToRemove) {
    setFiles((previous) =>
      previous.filter((_, index) => index !== indexToRemove)
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (files.length > 0) {
      setError(
        "Your selected files are only previews. Remove them and provide secure HTTPS document links below, or connect file storage before submitting these documents."
      );
      return;
    }

    const evidenceUrls = form.evidenceUrls
      .split("\n")
      .map((url) => url.trim())
      .filter(Boolean);

    if (evidenceUrls.length > 5) {
      setError("You can provide up to 5 evidence links.");
      return;
    }

    if (evidenceUrls.some((url) => !/^https:\/\/\S+$/i.test(url))) {
      setError("Each evidence link must be a valid HTTPS URL.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legalBusinessName: form.legalBusinessName.trim(),
          country: form.country.trim(),
          registrationNumber: form.registrationNumber.trim(),
          website: form.website.trim(),
          businessEmail: form.businessEmail.trim(),
          representativeName: form.representativeName.trim(),
          representativeRole: form.representativeRole.trim(),
          evidenceUrls,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit your application.");
      }

      setMessage(data.message || "Your application has been submitted.");
      await loadVerification();
    } catch (err) {
      setError(err.message || "Unable to submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    sessionStorage.removeItem("syncToken");
    sessionStorage.removeItem("syncUser");
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="company-loading">
        <div className="company-spinner" />
        <p>Loading your company workspace...</p>
      </main>
    );
  }

  if (error && !verification) {
    return (
      <main className="company-page">
        <section className="company-error-card">
          <h2>Unable to load your workspace</h2>
          <p>{error}</p>
          <button className="company-button" onClick={loadVerification}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="company-page">
      <aside className="company-sidebar">
        <a className="company-brand" href="/company/dashboard">
          <span className="company-brand-mark">S</span>
          <span>SYNC</span>
        </a>

        <span className="company-sidebar-label">WORKSPACE</span>
        <a className="company-nav active" href="#overview">
          <span>⌂</span> Dashboard
        </a>
        <a className="company-nav" href="#verification">
          <span>✓</span> Verification
        </a>
        <a className="company-nav" href="#opportunities">
          <span>↗</span> Opportunities
        </a>
        <a className="company-nav" href="#applicants">
          <span>♧</span> Applicants
        </a>

        <div className="company-sidebar-bottom">
          <div className="company-avatar">
            {(user.name || "C").charAt(0).toUpperCase()}
          </div>
          <div className="company-sidebar-user">
            <strong>{user.name || "Your company"}</strong>
            <span>Company account</span>
          </div>
          <button
            className="company-sidebar-logout"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
          >
            ↗
          </button>
        </div>
      </aside>

      <div className="company-main">
        <header className="company-topbar">
          <div>
            <span className="company-eyebrow">COMPANY WORKSPACE</span>
            <p>Welcome back, {user.name || "Company"}</p>
          </div>
          <button className="company-logout" onClick={logout}>
            Log out
          </button>
        </header>

        <section className="company-welcome" id="overview">
          <div>
            <span className="company-eyebrow">BUILD YOUR PRESENCE</span>
            <h1>Your business,<br />built together.</h1>
            <p>
              Verify your business to build trust with the SYNC community
              and unlock company opportunities.
            </p>
          </div>
          <div className="company-welcome-mark" aria-hidden="true">
            <span>S</span>
            <i />
            <i />
            <i />
          </div>
        </section>

        <section className="company-overview-grid">
          <article className="company-overview-card">
            <span className="company-overview-icon">✓</span>
            <span className="company-eyebrow">VERIFICATION</span>
            <strong>{statusInfo.label}</strong>
            <span className="company-overview-caption">
              Current application status
            </span>
          </article>

          <article className="company-overview-card">
            <span className="company-overview-icon">↗</span>
            <span className="company-eyebrow">OPPORTUNITIES</span>
            <strong>{verified ? "Publishing unlocked" : "Locked"}</strong>
            <span className="company-overview-caption">
              {verified ? "Your company can publish" : "Approval is required"}
            </span>
          </article>

          <article className="company-overview-card">
            <span className="company-overview-icon">▤</span>
            <span className="company-eyebrow">DOCUMENTS</span>
            <strong>{files.length} selected</strong>
            <span className="company-overview-caption">
              Selected in this browser session
            </span>
          </article>
        </section>

        <section className="company-status-banner">
          <div className="company-status-symbol">
            {verified ? "✓" : status === "rejected" ? "!" : "i"}
          </div>
          <div className="company-status-copy">
            <span className={`company-status-pill company-status-${status}`}>
              {statusInfo.label}
            </span>
            <h2>{statusInfo.title}</h2>
            <p>{statusInfo.description}</p>
            {verification?.reviewNote && (
              <div className="company-review-note">
                <strong>Administrator feedback</strong>
                <p>{verification.reviewNote}</p>
              </div>
            )}
          </div>
        </section>

        <section className="company-section" id="verification">
          <div className="company-section-heading">
            <div>
              <span className="company-eyebrow">BUSINESS CREDENTIALS</span>
              <h2>Company verification</h2>
              <p>
                Provide accurate business details and supporting evidence.
              </p>
            </div>
            <span className="company-step-count">01 / 03</span>
          </div>

          <div className="company-progress">
            <span className={form.legalBusinessName ? "complete" : ""} />
            <span className={files.length || form.evidenceUrls ? "complete" : ""} />
            <span className={verified ? "complete" : ""} />
          </div>

          {!canSubmit ? (
            <div className="company-readonly-card">
              <div className="company-readonly-icon">{verified ? "✓" : "◷"}</div>
              <div>
                <h3>
                  {verified
                    ? "Verification complete"
                    : "Your application is currently locked for editing"}
                </h3>
                <p>
                  {verified
                    ? "Your company has passed verification. You can proceed to the opportunities section."
                    : "You can edit your application if the administrator requests more information or the application is rejected."}
                </p>
              </div>
            </div>
          ) : (
            <form className="company-form" onSubmit={handleSubmit}>
              <div className="company-form-section-title">
                <span>01</span>
                <div>
                  <h3>Business information</h3>
                  <p>Tell us about the company you represent.</p>
                </div>
              </div>

              <div className="company-form-grid">
                <label className="company-field">
                  Legal business name <span>*</span>
                  <input
                    name="legalBusinessName"
                    value={form.legalBusinessName}
                    onChange={updateField}
                    placeholder="e.g. BluePeak Innovations"
                    required
                    minLength={2}
                  />
                </label>

                <label className="company-field">
                  Country <span>*</span>
                  <input
                    name="country"
                    value={form.country}
                    onChange={updateField}
                    placeholder="Country of registration"
                    required
                  />
                </label>

                <label className="company-field">
                  Registration number
                  <input
                    name="registrationNumber"
                    value={form.registrationNumber}
                    onChange={updateField}
                    placeholder="Company registration number"
                  />
                </label>

                <label className="company-field">
                  Official website
                  <input
                    name="website"
                    type="url"
                    value={form.website}
                    onChange={updateField}
                    placeholder="https://yourcompany.com"
                  />
                </label>

                <label className="company-field company-field-full">
                  Business email address <span>*</span>
                  <input
                    name="businessEmail"
                    type="email"
                    value={form.businessEmail}
                    onChange={updateField}
                    placeholder="name@yourcompany.com"
                    required
                  />
                  <small>Use an email address associated with your business where possible.</small>
                </label>
              </div>

              <div className="company-form-divider" />

              <div className="company-form-section-title">
                <span>02</span>
                <div>
                  <h3>Authorized representative</h3>
                  <p>Who is submitting this application?</p>
                </div>
              </div>

              <div className="company-form-grid">
                <label className="company-field">
                  Full name <span>*</span>
                  <input
                    name="representativeName"
                    value={form.representativeName}
                    onChange={updateField}
                    placeholder="Representative's full name"
                    required
                  />
                </label>

                <label className="company-field">
                  Job title / role <span>*</span>
                  <input
                    name="representativeRole"
                    value={form.representativeRole}
                    onChange={updateField}
                    placeholder="e.g. Founder, HR Manager"
                    required
                  />
                </label>
              </div>

              <div className="company-form-divider" />

              <div className="company-form-section-title">
                <span>03</span>
                <div>
                  <h3>Supporting documents</h3>
                  <p>Add your registration certificate or other business evidence.</p>
                </div>
              </div>

              <label className="company-upload-zone">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  multiple
                  onChange={selectFiles}
                />
                <span className="company-upload-icon">↑</span>
                <strong>Choose documents from your device</strong>
                <span>PDF, JPG or PNG · Maximum 5 MB per file</span>
                <span className="company-upload-link">Browse files</span>
              </label>

              {files.length > 0 && (
                <div className="company-file-list">
                  {files.map((file, index) => (
                    <div className="company-file-item" key={`${file.name}-${file.size}`}>
                      <span className="company-file-icon">
                        {file.type === "application/pdf" ? "PDF" : "IMG"}
                      </span>
                      <div>
                        <strong>{file.name}</strong>
                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB · Local preview only</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        aria-label={`Remove ${file.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="company-field company-evidence-field">
                Or provide secure HTTPS evidence links
                <textarea
                  name="evidenceUrls"
                  value={form.evidenceUrls}
                  onChange={updateField}
                  placeholder={"https://example.com/registration-document.pdf\nhttps://example.com/business-proof.pdf"}
                  rows={3}
                />
                <small>One URL per line, up to 5 links. Only use links you are authorized to share.</small>
              </label>

              <div className="company-upload-warning">
                <strong>Document upload setup</strong>
                <p>
                  File selection currently provides a local preview only.
                  Selected files are not sent to the server. To submit actual
                  files, secure file storage must be connected first.
                </p>
              </div>

              {error && <div className="company-form-message error">{error}</div>}
              {message && <div className="company-form-message success">{message}</div>}

              <div className="company-form-actions">
                <p>
                  <span>*</span> Required fields
                </p>
                <button className="company-button" type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit for verification"}
                  {!submitting && <span> →</span>}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="company-section company-opportunities" id="opportunities">
          <div className="company-section-heading">
            <div>
              <span className="company-eyebrow">GROW WITH SYNC</span>
              <h2>Company opportunities</h2>
              <p>Create and manage jobs, internships, and projects for the SYNC community.</p>
            </div>
            <button
              type="button"
              className="company-button"
              onClick={() => {
                setOpportunityError("");
                setOpportunityMessage("");
                if (showOpportunityForm) {
                  resetOpportunityForm();
                } else {
                  setEditingOpportunityId(null);
                  setOpportunityForm({ ...EMPTY_OPPORTUNITY });
                  setShowOpportunityForm(true);
                }
              }}
            >
              {showOpportunityForm ? "Cancel" : "+ Create opportunity"}
            </button>
          </div>

          {!verified && (
            <div className="company-readonly-card">
              <div className="company-readonly-icon">i</div>
              <div>
                <h3>Publishing requires verification</h3>
                <p>You can save drafts, but your company must be verified before publishing an opportunity.</p>
              </div>
            </div>
          )}

          {opportunityError && <div className="company-form-message error" role="alert">{opportunityError}</div>}
          {opportunityMessage && <div className="company-form-message success" role="status">{opportunityMessage}</div>}

          {showOpportunityForm && (
            <form className="company-form" onSubmit={saveOpportunity}>
              <div className="company-form-section-title">
                <span>+</span>
                <div>
                  <h3>{editingOpportunityId ? "Edit opportunity" : "New opportunity"}</h3>
                  <p>Enter the details candidates will see on SYNC.</p>
                </div>
              </div>

              <div className="company-form-grid">
                <label className="company-field">
                  Opportunity type <span>*</span>
                  <select name="type" value={opportunityForm.type} onChange={updateOpportunityField} required>
                    <option value="job">Job</option>
                    <option value="internship">Internship</option>
                    <option value="project">Project</option>
                  </select>
                </label>

                <label className="company-field">
                  Title <span>*</span>
                  <input name="title" value={opportunityForm.title} onChange={updateOpportunityField} placeholder="e.g. Frontend Developer Intern" minLength={3} maxLength={120} required />
                </label>

                <label className="company-field company-field-full">
                  Description <span>*</span>
                  <textarea name="description" value={opportunityForm.description} onChange={updateOpportunityField} placeholder="Describe responsibilities, requirements, and what candidates will gain." minLength={20} maxLength={5000} rows={5} required />
                </label>

                <label className="company-field company-field-full">
                  Skills
                  <input name="skills" value={opportunityForm.skills} onChange={updateOpportunityField} placeholder="React, Node.js, MongoDB" />
                  <small>Separate skills with commas.</small>
                </label>

                <label className="company-field">
                  Work mode
                  <select name="workMode" value={opportunityForm.workMode} onChange={updateOpportunityField}>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </label>

                <label className="company-field">
                  Location
                  <input name="location" value={opportunityForm.location} onChange={updateOpportunityField} placeholder="Remote or city" />
                </label>

                <label className="company-field">
                  Employment type
                  <select name="employmentType" value={opportunityForm.employmentType} onChange={updateOpportunityField}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                    <option value="Project-based">Project-based</option>
                  </select>
                </label>

                <label className="company-field">
                  Experience level
                  <select name="experienceLevel" value={opportunityForm.experienceLevel} onChange={updateOpportunityField}>
                    <option value="Entry-level">Entry-level</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Experienced">Experienced</option>
                    <option value="Any">Any experience</option>
                  </select>
                </label>

                <label className="company-field">
                  Minimum salary / stipend (INR)
                  <input name="salaryMin" type="number" min="0" value={opportunityForm.salaryMin} onChange={updateOpportunityField} placeholder="Optional" />
                </label>

                <label className="company-field">
                  Maximum salary / stipend (INR)
                  <input name="salaryMax" type="number" min="0" value={opportunityForm.salaryMax} onChange={updateOpportunityField} placeholder="Optional" />
                </label>

                <label className="company-field">
                  Application deadline
                  <input name="deadline" type="date" value={opportunityForm.deadline} onChange={updateOpportunityField} />
                </label>

                <label className="company-field">
                  Application URL
                  <input name="applicationUrl" type="url" value={opportunityForm.applicationUrl} onChange={updateOpportunityField} placeholder="https://..." />
                </label>

                <label className="company-field company-field-full">
                  Application email
                  <input name="applicationEmail" type="email" value={opportunityForm.applicationEmail} onChange={updateOpportunityField} placeholder="careers@company.com" />
                </label>

                <label className="company-field">
                  Save as <span>*</span>
                  <select name="status" value={opportunityForm.status} onChange={updateOpportunityField}>
                    <option value="draft">Draft</option>
                    <option value="published" disabled={!verified}>Published</option>
                  </select>
                  {!verified && <small>Publishing unlocks after company verification.</small>}
                </label>
              </div>

              <div className="company-form-actions">
                <p><span>*</span> Required fields</p>
                <button type="submit" className="company-button" disabled={opportunitySubmitting}>
                  {opportunitySubmitting ? "Saving..." : editingOpportunityId ? "Save changes" : "Save opportunity"}
                </button>
              </div>
            </form>
          )}

          <div className="company-opportunity-list">
            <div className="company-form-section-title">
              <span>▤</span>
              <div>
                <h3>Your opportunities</h3>
                <p>Manage your saved and published listings.</p>
              </div>
              <button type="button" className="company-button company-button-secondary" onClick={loadOpportunities} disabled={opportunitiesLoading}>
                {opportunitiesLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {opportunitiesLoading ? (
              <p>Loading your opportunities...</p>
            ) : opportunities.length === 0 ? (
              <div className="company-readonly-card">
                <div className="company-readonly-icon">↗</div>
                <div><h3>No opportunities yet</h3><p>Create your first job, internship, or project opportunity.</p></div>
              </div>
            ) : (
              opportunities.map((opportunity) => (
                <article className="company-opportunity-card" key={opportunity._id}>
                  <div className="company-opportunity-icon">↗</div>
                  <div className="company-opportunity-details">
                    <span className={`company-status-pill company-status-${opportunity.status || "draft"}`}>{opportunity.status || "draft"}</span>
                    <h3>{opportunity.title}</h3>
                    <p>{opportunity.type} · {opportunity.workMode || "Remote"} · {opportunity.location || "Remote"}</p>
                    <p>{(opportunity.description || "").length > 180 ? `${opportunity.description.slice(0, 180)}...` : opportunity.description}</p>
                    {Array.isArray(opportunity.skills) && opportunity.skills.length > 0 && <p><strong>Skills:</strong> {opportunity.skills.join(", ")}</p>}
                    <small>Updated {opportunity.updatedAt ? new Date(opportunity.updatedAt).toLocaleDateString() : "recently"}</small>
                    <div className="company-opportunity-actions">
                      <button type="button" className="company-button company-button-secondary" onClick={() => editOpportunity(opportunity)}>Edit</button>
                      {opportunity.status !== "published" ? (
                        <button type="button" className="company-button" disabled={!verified} onClick={() => changeOpportunityStatus(opportunity, "published")}>Publish</button>
                      ) : (
                        <button type="button" className="company-button company-button-secondary" onClick={() => changeOpportunityStatus(opportunity, "closed")}>Close listing</button>
                      )}
                      {opportunity.status === "closed" && <button type="button" className="company-button company-button-secondary" disabled={!verified} onClick={() => changeOpportunityStatus(opportunity, "published")}>Reopen</button>}
                      <button type="button" className="company-button company-button-danger" onClick={() => deleteOpportunity(opportunity)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="company-section" id="applicants">
          <div className="company-section-heading">
            <div>
              <span className="company-eyebrow">CANDIDATE MANAGEMENT</span>
              <h2>Opportunity applicants</h2>
              <p>Review applications submitted to your company's opportunities.</p>
            </div>
            <button
              type="button"
              className="company-button"
              onClick={loadOpportunityApplications}
              disabled={applicationsLoading}
            >
              {applicationsLoading ? "Refreshing..." : "Refresh applicants"}
            </button>
          </div>

          {applicationsError && (
            <div className="company-form-message error" role="alert">
              {applicationsError}
            </div>
          )}

          {applicationsLoading ? (
            <div className="company-readonly-card">
              <div className="company-readonly-icon">◷</div>
              <div>
                <h3>Loading applications</h3>
                <p>Checking applications submitted to your opportunities.</p>
              </div>
            </div>
          ) : applications.length === 0 ? (
            <div className="company-readonly-card">
              <div className="company-readonly-icon">▤</div>
              <div>
                <h3>No applications yet</h3>
                <p>
                  Applications will appear here when candidates submit them through the SYNC feed.
                  Use Refresh applicants to check again.
                </p>
              </div>
            </div>
          ) : (
            <div className="company-applications-list">
              {applications.map((application) => (
                <article
                  className="company-opportunity-card company-applicant-card"
                  key={application._id}
                >
                  <div className="company-opportunity-icon">
                    {(application.applicant?.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div className="company-applicant-content">
                    <span className="company-eyebrow">
                      {application.opportunity?.title || "Company opportunity"}
                    </span>
                    <h3>{application.applicant?.name || "SYNC member"}</h3>
                    {application.applicant?.email && (
                      <p>{application.applicant.email}</p>
                    )}
                    {application.applicant?.bio && (
                      <p>{application.applicant.bio}</p>
                    )}
                    <p className="company-applicant-message">{application.message}</p>
                    {application.resumeUrl && (
                      <p>
                        <a href={application.resumeUrl} target="_blank" rel="noopener noreferrer">
                          View resume ↗
                        </a>
                      </p>
                    )}
                    <p>
                      Status: <strong>{application.status || "pending"}</strong>
                      {application.createdAt && (
                        <> · Applied {new Date(application.createdAt).toLocaleDateString()}</>
                      )}
                    </p>

                    {(application.status || "pending") === "accepted" && (
                      <div className="company-payment-panel">
                        {application.payment?.status === "paid" ? (
                          <>
                            <div className="company-payment-heading">
                              <strong>Payment recorded</strong>
                              <span className="company-payment-paid">PAID</span>
                            </div>
                            <p>Amount: <strong>₹{Number(application.payment.amount || 0).toLocaleString("en-IN")}</strong></p>
                            <p>Method: {application.payment.method === "bank_transfer" ? "Bank transfer / NEFT / IMPS" : "UPI"}</p>
                            <p>Reference: <code>{application.payment.transactionReference}</code></p>
                            {application.payment.paidAt && <small>Recorded on {new Date(application.payment.paidAt).toLocaleString("en-IN")}</small>}
                          </>
                        ) : (
                          <>
                            <div className="company-payment-heading">
                              <strong>Pay accepted collaborator</strong>
                              <span className="company-payment-unpaid">UNPAID</span>
                            </div>
                            <p className="company-payment-note">First transfer the money using your UPI or bank app. Then record the transfer details below. This form does not move money automatically.</p>
                            <div className="company-payment-fields">
                              <label className="company-field">
                                Amount (₹)
                                <input
                                  type="number"
                                  min="1"
                                  max="10000000"
                                  step="0.01"
                                  inputMode="decimal"
                                  placeholder="e.g. 5000"
                                  value={paymentAmounts[application._id] || ""}
                                  onChange={(event) => updatePaymentField(setPaymentAmounts, application._id, event.target.value)}
                                />
                              </label>
                              <label className="company-field">
                                Transfer method
                                <select
                                  value={paymentMethods[application._id] || "upi"}
                                  onChange={(event) => updatePaymentField(setPaymentMethods, application._id, event.target.value)}
                                >
                                  <option value="upi">UPI</option>
                                  <option value="bank_transfer">Bank transfer / NEFT / IMPS</option>
                                </select>
                              </label>
                              <label className="company-field company-field-full">
                                UPI reference / UTR
                                <input
                                  type="text"
                                  minLength="4"
                                  maxLength="100"
                                  placeholder="Enter transaction reference after transferring"
                                  value={paymentReferences[application._id] || ""}
                                  onChange={(event) => updatePaymentField(setPaymentReferences, application._id, event.target.value)}
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              className="company-button company-payment-button"
                              disabled={recordingPaymentId === application._id}
                              onClick={() => recordCollaboratorPayment(application)}
                            >
                              {recordingPaymentId === application._id ? "Saving payment..." : "Record payment after transfer"}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {(application.status || "pending") === "pending" && (
                      <div className="company-applicant-actions">
                        <button
                          type="button"
                          className="company-button company-button-secondary"
                          disabled={reviewingApplicationId === application._id}
                          onClick={() => reviewOpportunityApplication(application._id, "rejected")}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="company-button"
                          disabled={reviewingApplicationId === application._id}
                          onClick={() => reviewOpportunityApplication(application._id, "accepted")}
                        >
                          {reviewingApplicationId === application._id ? "Updating..." : "Accept candidate"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="company-footer">
          <span>© 2026 SYNC</span>
          <span>Connect. Collaborate. Create.</span>
        </footer>
      </div>
    </main>
  );
}
