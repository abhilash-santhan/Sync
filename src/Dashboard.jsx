
import React, { useEffect, useRef, useState } from "react";
import "./Dashboard.css";

const API_URL = "http://localhost:3001/api/auth";
const PROJECTS_API_URL = "http://localhost:3001/api/projects";
const OPPORTUNITIES_API_URL = "http://localhost:3001/api/opportunities";
const APPLICATIONS_API_URL = "http://localhost:3001/api/applications";
const FOLLOW_API_URL = "http://localhost:3001/api/follow";

const formatSize = (bytes = 0) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const formatTime = (date) => {
  if (!date) return "Recently";

  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "Recently";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000)
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return new Date(date).toLocaleDateString();
};

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const getOwner = (project) =>
  project.owner ??
  project.createdBy ??
  project.ownerId ??
  project.createdById ??
  null;

const formatProject = (project) => {
  const owner = getOwner(project);
  const ownerObject = owner && typeof owner === "object" ? owner : null;

  const resolvedOwnerId = String(
    ownerObject?._id ??
      ownerObject?.id ??
      project.ownerId ??
      project.createdById ??
      (typeof owner === "string" ? owner : "") ??
      ""
  );

  const ownerRole = String(ownerObject?.role || "").toLowerCase();

  return {
    id: String(project._id || project.id || ""),
    ownerId: resolvedOwnerId,
    type: "Project",
    createdAt: project.createdAt || null,
    time: formatTime(project.createdAt),
    title: project.title || "Untitled project",
    text: project.description || "",
    author:
      ownerObject?.name ||
      project.ownerName ||
      project.createdByName ||
      "SYNC member",
    role: ownerRole === "company" ? "Company" : "Individual · SYNC Member",
    isVerified:
      ownerObject?.companyVerification?.status === "verified" ||
      ownerObject?.verificationStatus === "verified",
    isPaid: Boolean(project.isPaid),
    tags: parseArray(project.tags),
    rolesNeeded: parseArray(project.rolesNeeded),
    experience: project.experience || "Beginner",
    thumbnail: project.thumbnail
      ? project.thumbnail.startsWith("http")
        ? project.thumbnail
        : `http://localhost:3001${project.thumbnail}`
      : null,
    attachments: parseArray(project.attachments),
    likes: Number(project.likesCount || 0),
    comments: Number(project.commentsCount || 0),
    openToCollaborators: project.openToCollaborators ?? true,
    githubVisibility: project.githubVisibility || "private",
    hasPrivateGithubLink: Boolean(project.githubUrl),
  };
};

const formatOpportunity = (opportunity) => {
  const company =
    opportunity.company && typeof opportunity.company === "object"
      ? opportunity.company
      : opportunity.createdBy &&
          typeof opportunity.createdBy === "object"
        ? opportunity.createdBy
        : null;

  const verificationStatus = String(
    company?.companyVerification?.status ||
      company?.verificationStatus ||
      opportunity.companyVerification?.status ||
      ""
  ).toLowerCase();

  const salaryMin =
    opportunity.salaryMin == null || opportunity.salaryMin === ""
      ? null
      : Number(opportunity.salaryMin);

  const salaryMax =
    opportunity.salaryMax == null || opportunity.salaryMax === ""
      ? null
      : Number(opportunity.salaryMax);

  return {
    id: String(opportunity._id || opportunity.id || ""),
    ownerId: String(
      company?._id ||
        company?.id ||
        opportunity.companyId ||
        opportunity.createdById ||
        ""
    ),
    type: "Opportunity",
    opportunityType: String(
      opportunity.type || opportunity.opportunityType || "job"
    ).toLowerCase(),
    createdAt: opportunity.createdAt || null,
    time: formatTime(opportunity.createdAt),
    title: opportunity.title || "Untitled opportunity",
    text: opportunity.description || "",
    author: company?.name || opportunity.companyName || "SYNC Company",
    role: "Company",
    isVerified: verificationStatus === "verified",
    isPaid:
      (salaryMin !== null && salaryMin > 0) ||
      (salaryMax !== null && salaryMax > 0),
    tags: parseArray(opportunity.skills || opportunity.tags),
    rolesNeeded: [],
    experience:
      opportunity.experienceLevel || opportunity.experience || "Any",
    thumbnail: null,
    attachments: [],
    likes: 0,
    comments: 0,
    openToCollaborators: false,
    githubVisibility: "private",
    hasPrivateGithubLink: false,
    location: opportunity.location || "Remote",
    workMode: opportunity.workMode || "Remote",
    employmentType: opportunity.employmentType || "",
    salaryMin,
    salaryMax,
    currency: opportunity.currency || "INR",
    applicationUrl: opportunity.applicationUrl || "",
    applicationEmail: opportunity.applicationEmail || "",
    deadline: opportunity.deadline || null,
    status: opportunity.status || "published",
  };
};

async function readResponse(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `The server returned an invalid response (HTTP ${response.status}).`
    );
  }
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [posts, setPosts] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const [likedPosts, setLikedPosts] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [followLoadingId, setFollowLoadingId] = useState(null);

  const [feedFilter, setFeedFilter] = useState("For You");
  const [projectFilter, setProjectFilter] = useState("All Projects");

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [message, setMessage] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubVisibility, setGithubVisibility] = useState("private");
  const [thumbnail, setThumbnail] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [tags, setTags] = useState("");
  const [rolesNeeded, setRolesNeeded] = useState("");
  const [experience, setExperience] = useState("Beginner");
  const [openToCollaborators, setOpenToCollaborators] = useState(true);

  const [openPostMenu, setOpenPostMenu] = useState(null);

  const [showMyApplications, setShowMyApplications] = useState(false);
  const [myApplications, setMyApplications] = useState([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(false);
  const [myApplicationsError, setMyApplicationsError] = useState("");

  const [applyingTo, setApplyingTo] = useState(null);
  const [applicationMessages, setApplicationMessages] = useState({});
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [applicationNotice, setApplicationNotice] = useState("");

  const [managedProjectId, setManagedProjectId] = useState(null);
  const [managedApplications, setManagedApplications] = useState([]);
  const [managedApplicationsLoading, setManagedApplicationsLoading] =
    useState(false);
  const [managedApplicationsError, setManagedApplicationsError] = useState("");
  const [reviewingApplication, setReviewingApplication] = useState(null);

  const [collaborationProjectIds, setCollaborationProjectIds] = useState([]);
  const [collaborationAccessLoading, setCollaborationAccessLoading] =
    useState(true);
    const [applyingToOpportunity, setApplyingToOpportunity] = useState(null);
  const [opportunityApplicationMessage, setOpportunityApplicationMessage] =
    useState("");
  const [opportunityApplicationError, setOpportunityApplicationError] =
    useState("");
  const [submittingOpportunityApplication, setSubmittingOpportunityApplication] =
    useState(false);
    
    const [managedOpportunityId, setManagedOpportunityId] = useState(null);
    const [opportunityApplicants, setOpportunityApplicants] = useState([]);
    const [opportunityApplicantsLoading, setOpportunityApplicantsLoading] =
      useState(false);
    const [opportunityApplicantsError, setOpportunityApplicantsError] =
      useState("");
  const [paymentForms, setPaymentForms] = useState({});
  const [payingApplicationId, setPayingApplicationId] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const thumbnailRef = useRef(null);
  const documentRef = useRef(null);

  const currentUserId = String(user?._id || user?.id || "");

  const getToken = () => sessionStorage.getItem("syncToken");

  const getAuthHeaders = () => {
    const token = getToken();

    if (!token) {
      handleLogout();
      return null;
    }

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const handleLogout = () => {
    sessionStorage.removeItem("syncToken");
    sessionStorage.removeItem("syncUser");
    window.location.replace("/");
  };

  // Load the signed-in user.
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const token = getToken();

      if (!token) {
        if (!cancelled) {
          setAuthError("Please log in to access your SYNC dashboard.");
          setAuthLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(data.message || "Unable to load your profile.");
        }

        const profile = data.user || data;

        if (!profile || !(profile._id || profile.id)) {
          throw new Error("The server did not return a valid user profile.");
        }

        if (!cancelled) {
          setUser(profile);
          sessionStorage.setItem("syncUser", JSON.stringify(profile));
          setAuthError("");
        }
      } catch (error) {
        console.error("Load profile error:", error);

        if (!cancelled) {
          setAuthError(error.message || "Unable to load your profile.");
          setUser(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load projects AND company opportunities in one request cycle.
  // There must not be another feed-loading effect that overwrites these posts.
  const loadFeed = async () => {
    setProjectsLoading(true);
    setProjectError("");

    try {
      const [projectsResponse, opportunitiesResponse] = await Promise.all([
        fetch(PROJECTS_API_URL),
        fetch(OPPORTUNITIES_API_URL),
      ]);

      const [projectsData, opportunitiesData] = await Promise.all([
        readResponse(projectsResponse),
        readResponse(opportunitiesResponse),
      ]);

      if (!projectsResponse.ok) {
        throw new Error(
          projectsData.message || "Unable to load community projects."
        );
      }

      if (!opportunitiesResponse.ok) {
        throw new Error(
          opportunitiesData.message || "Unable to load company opportunities."
        );
      }

      const projects = (projectsData.projects || []).map(formatProject);
      const opportunities = (
        opportunitiesData.opportunities || []
      ).map(formatOpportunity);

      const combined = [...projects, ...opportunities].filter(
        (post) => post.id
      );

      combined.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );

      console.log("SYNC feed projects:", projects);
      console.log("SYNC feed opportunities:", opportunities);

      setPosts(combined);
    } catch (error) {
      console.error("Load SYNC feed error:", error);
      setProjectError(error.message || "Unable to load the SYNC feed.");
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // Load the accounts followed by the current user.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadFollowing() {
      const token = getToken();
      if (!token) return;

      try {
        const response = await fetch(`${FOLLOW_API_URL}/following/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(data.message || "Unable to load following list.");
        }

        const ids = (data.following || [])
          .map((person) => person._id || person.id)
          .filter(Boolean)
          .map(String);

        if (!cancelled) setFollowingIds(ids);
      } catch (error) {
        console.error("Load following error:", error.message);
      }
    }

    loadFollowing();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load accepted collaboration access.
  useEffect(() => {
    if (!user) {
      setCollaborationAccessLoading(false);
      return;
    }

    let cancelled = false;

    async function loadCollaborationAccess() {
      const token = getToken();

      if (!token) {
        if (!cancelled) {
          setCollaborationProjectIds([]);
          setCollaborationAccessLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${APPLICATIONS_API_URL}/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to check collaboration access."
          );
        }

        const ids = (data.applications || [])
          .filter(
            (application) =>
              String(application.status).toLowerCase() === "accepted"
          )
          .map((application) => {
            const project = application.project;

            if (project && typeof project === "object") {
              return project._id || project.id;
            }

            return project || application.projectId;
          })
          .filter(Boolean)
          .map(String);

        if (!cancelled) setCollaborationProjectIds(ids);
      } catch (error) {
        console.error("Load collaboration access error:", error);
        if (!cancelled) setCollaborationProjectIds([]);
      } finally {
        if (!cancelled) setCollaborationAccessLoading(false);
      }
    }

    loadCollaborationAccess();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setGithubUrl("");
    setGithubVisibility("private");
    setThumbnail(null);
    setDocuments([]);
    setTags("");
    setRolesNeeded("");
    setExperience("Beginner");
    setOpenToCollaborators(true);
    setMessage("");

    if (thumbnailRef.current) thumbnailRef.current.value = "";
    if (documentRef.current) documentRef.current.value = "";
  };

  const publishProject = async (event) => {
    event.preventDefault();
    setMessage("");
    setProjectError("");

    const token = getToken();

    if (!token) {
      handleLogout();
      return;
    }

    if (title.trim().length < 3 || title.trim().length > 100) {
      setMessage("The title must be between 3 and 100 characters.");
      return;
    }

    if (
      description.trim().length < 10 ||
      description.trim().length > 3000
    ) {
      setMessage("The description must be between 10 and 3000 characters.");
      return;
    }

    if (thumbnail) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];

      if (!allowedTypes.includes(thumbnail.type)) {
        setMessage("Choose a JPG, PNG, WEBP, or GIF image.");
        return;
      }

      if (thumbnail.size > 5 * 1024 * 1024) {
        setMessage("The thumbnail must be smaller than 5 MB.");
        return;
      }
    }

    if (githubUrl.trim()) {
      try {
        const url = new URL(githubUrl.trim());

        if (
          url.protocol !== "https:" ||
          !["github.com", "www.github.com"].includes(url.hostname)
        ) {
          setMessage("Enter a valid GitHub repository URL.");
          return;
        }
      } catch {
        setMessage("Enter a valid GitHub repository URL.");
        return;
      }
    }

    const formData = new FormData();

    formData.append("title", title.trim());
    formData.append("description", description.trim());

    formData.append(
      "tags",
      JSON.stringify(
        tags
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
      )
    );

    formData.append(
      "rolesNeeded",
      JSON.stringify(
        rolesNeeded
          .split(",")
          .map((role) => role.trim())
          .filter(Boolean)
      )
    );

    formData.append("experience", experience);
    formData.append("githubUrl", githubUrl.trim());
    formData.append("githubVisibility", githubVisibility);
    formData.append("openToCollaborators", String(openToCollaborators));

    if (thumbnail) formData.append("thumbnail", thumbnail);

    // The current backend upload handler must support document uploads
    // before these files can be persisted and made downloadable.
    documents.forEach((file) => formData.append("documents", file));

    try {
      setPublishing(true);

      const response = await fetch(PROJECTS_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await readResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }

        throw new Error(data.message || "Unable to publish project.");
      }

      if (!data.project) {
        throw new Error("The server did not return the saved project.");
      }

      setPosts((current) => [
        formatProject(data.project),
        ...current.filter(
          (post) => post.id !== String(data.project._id || data.project.id)
        ),
      ]);

      resetForm();
      setShowProjectForm(false);
      setApplicationNotice("Project published successfully.");
    } catch (error) {
      console.error("Publish project error:", error);
      setMessage(error.message || "Unable to publish project.");
    } finally {
      setPublishing(false);
    }
  };

  const deleteProject = async (post) => {
    if (post.type !== "Project") {
      window.alert("Company opportunities must be managed from the company dashboard.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${post.title}"?`)) {
      return;
    }

    const token = getToken();

    if (!token) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch(
        `${PROJECTS_API_URL}/${encodeURIComponent(post.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete project.");
      }

      setPosts((current) => current.filter((item) => item.id !== post.id));

      if (managedProjectId === post.id) {
        setManagedProjectId(null);
        setManagedApplications([]);
      }

      setOpenPostMenu(null);
      setApplicationNotice("Project deleted successfully.");
    } catch (error) {
      console.error("Delete project error:", error);
      window.alert(error.message || "Unable to delete project.");
    }
  };

  const submitApplication = async (projectId) => {
    const applicationMessage = (applicationMessages[projectId] || "").trim();

    if (applicationMessage.length < 20 || applicationMessage.length > 1000) {
      setApplicationNotice(
        "Your application message must be between 20 and 1000 characters."
      );
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      setSubmittingApplication(true);
      setApplicationNotice("");

      const response = await fetch(`${APPLICATIONS_API_URL}/${projectId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: applicationMessage }),
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit your application.");
      }

      setApplicationMessages((current) => ({
        ...current,
        [projectId]: "",
      }));

      setApplyingTo(null);
      setApplicationNotice("Application submitted successfully.");
    } catch (error) {
      setApplicationNotice(
        error.message || "Unable to submit your application."
      );
    } finally {
      setSubmittingApplication(false);
    }
  };
  const submitOpportunityApplication = async (opportunityId) => {
    const applicationMessage = opportunityApplicationMessage.trim();

    // Validate here rather than relying on browser minLength/required checks,
    // so every validation error is visible in the form.
    if (applicationMessage.length < 20 || applicationMessage.length > 1000) {
      setOpportunityApplicationError(
        "Please enter an application message between 20 and 1000 characters."
      );
      return;
    }

    if (user?.role !== "individual") {
      setOpportunityApplicationError(
        "Only individual accounts can apply to company opportunities."
      );
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      setSubmittingOpportunityApplication(true);
      setOpportunityApplicationError("");
      setApplicationNotice("");

      const response = await fetch(
        `${APPLICATIONS_API_URL}/opportunity/${encodeURIComponent(opportunityId)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ message: applicationMessage }),
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message || `Application failed (HTTP ${response.status}).`
        );
      }

      setApplyingToOpportunity(null);
      setOpportunityApplicationMessage("");
      setOpportunityApplicationError("");
      setApplicationNotice(
        data.message || "Your application was sent to the company successfully."
      );

      // Refresh the candidate's applications if the panel is already open.
      if (showMyApplications) {
        const refreshResponse = await fetch(`${APPLICATIONS_API_URL}/my`, {
          headers,
        });
        const refreshData = await readResponse(refreshResponse);
        if (refreshResponse.ok) {
          setMyApplications(refreshData.applications || []);
        }
      }
    } catch (error) {
      // Keep the error in the application form instead of logging it as a
      // console error that can trigger the development error overlay.
      const errorMessage =
        error && typeof error.message === "string" && error.message.trim()
          ? error.message
          : "The request failed before the server returned a response. Check that the SYNC backend is running on port 3001.";

      setOpportunityApplicationError(errorMessage);
    } finally {
      setSubmittingOpportunityApplication(false);
    }
  };

  const applyToOpportunity = (post) => {
    if (!currentUserId) {
      handleLogout();
      return;
    }
  
    if (String(post.ownerId) === currentUserId) {
      setApplicationNotice("You cannot apply to your own opportunity.");
      return;
    }
  
    setApplicationNotice("");
    setOpportunityApplicationError("");
    setApplyingToOpportunity((current) =>
      current === post.id ? null : post.id
    );
    setOpportunityApplicationMessage("");
  };
  
  const loadMyApplications = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      setMyApplicationsLoading(true);
      setMyApplicationsError("");

      const response = await fetch(`${APPLICATIONS_API_URL}/my`, { headers });
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load your applications.");
      }

      setMyApplications(data.applications || []);
      setShowMyApplications(true);
      setManagedProjectId(null);
    } catch (error) {
      setMyApplicationsError(
        error.message || "Unable to load your applications."
      );
      setShowMyApplications(true);
    } finally {
      setMyApplicationsLoading(false);
    }
  };

  const loadProjectApplications = async (projectId) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      setManagedApplicationsLoading(true);
      setManagedApplicationsError("");
      setManagedProjectId(projectId);
      setShowMyApplications(false);

      const response = await fetch(
        `${APPLICATIONS_API_URL}/project/${encodeURIComponent(projectId)}`,
        { headers }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load project applicants.");
      }

      setManagedApplications(data.applications || []);
    } catch (error) {
      setManagedApplicationsError(
        error.message || "Unable to load applicants."
      );
      setManagedApplications([]);
    } finally {
      setManagedApplicationsLoading(false);
    }
  };
  const loadOpportunityApplicants = async (opportunityId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
  
    try {
      setOpportunityApplicantsLoading(true);
      setOpportunityApplicantsError("");
      setManagedOpportunityId(opportunityId);
      setManagedProjectId(null);
      setShowMyApplications(false);
  
      const response = await fetch(
        `${APPLICATIONS_API_URL}/opportunity/${encodeURIComponent(opportunityId)}`,
        { headers }
      );
  
      const data = await readResponse(response);
  
      if (!response.ok) {
        throw new Error(data.message || "Unable to load applicants.");
      }
  
      setOpportunityApplicants(data.applications || []);
    } catch (error) {
      setOpportunityApplicantsError(
        error.message || "Unable to load opportunity applicants."
      );
      setOpportunityApplicants([]);
    } finally {
      setOpportunityApplicantsLoading(false);
    }
  };

  const reviewApplication = async (applicationId, status) => {
    if (!["accepted", "rejected"].includes(status)) {
      setManagedApplicationsError("Invalid application status.");
      return;
    }
  
    const headers = getAuthHeaders();
    if (!headers) return;
  
    try {
      setReviewingApplication(applicationId);
      setManagedApplicationsError("");
  
      const response = await fetch(
        `${APPLICATIONS_API_URL}/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status }),
        }
      );
  
      const data = await readResponse(response);
  
      if (!response.ok) {
        throw new Error(data.message || "Unable to update application.");
      }
  
      const updatedApplication = data.application;
  
      setManagedApplications((current) =>
        current.map((application) =>
          String(application._id) === String(applicationId)
            ? {
                ...application,
                ...updatedApplication,
                status: updatedApplication?.status || status,
              }
            : application
        )
      );
  
      setApplicationNotice(
        status === "rejected"
          ? "Collaboration request rejected."
          : "Collaboration request accepted."
      );
    } catch (error) {
      setManagedApplicationsError(
        error.message || "Unable to update application."
      );
    } finally {
      setReviewingApplication(null);
    }
  };
  
  const reviewOpportunityApplication = async (applicationId, status) => {
    if (!["accepted", "rejected"].includes(status)) {
      setOpportunityApplicantsError("Invalid application status.");
      return;
    }
  
    const headers = getAuthHeaders();
    if (!headers) return;
  
    try {
      setReviewingApplication(applicationId);
      setOpportunityApplicantsError("");
  
      const response = await fetch(
        `${APPLICATIONS_API_URL}/opportunity/application/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ status }),
        }
      );
  
      const data = await readResponse(response);
  
      if (!response.ok) {
        throw new Error(data.message || "Unable to update application.");
      }
  
      setOpportunityApplicants((current) =>
        current.map((application) =>
          String(application._id) === String(applicationId)
            ? { ...application, ...data.application, status }
            : application
        )
      );
  
      setApplicationNotice(
        status === "accepted"
          ? "Candidate accepted successfully."
          : "Candidate rejected successfully."
      );
    } catch (error) {
      setOpportunityApplicantsError(
        error.message || "Unable to review this application."
      );
    } finally {
      setReviewingApplication(null);
    }
  };
  const recordCollaboratorPayment = async (applicationId) => {
    const form = paymentForms[applicationId] || {};
    const amount = Number(form.amount);
    const method = form.method || "upi";
    const transactionReference = String(form.transactionReference || "").trim();

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      setPaymentError("Enter a valid payment amount between ₹0.01 and ₹1,00,00,000.");
      setPaymentMessage("");
      return;
    }

    if (transactionReference.length < 4 || transactionReference.length > 100) {
      setPaymentError("Enter a valid completed transaction reference or UTR (4–100 characters).");
      setPaymentMessage("");
      return;
    }

    const confirmed = window.confirm(
      `Confirm that you have already transferred ₹${amount.toLocaleString("en-IN")} to this collaborator?`
    );
    if (!confirmed) return;

    const headers = getAuthHeaders();
    if (!headers) return;

    setPayingApplicationId(applicationId);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const response = await fetch(
        `${APPLICATIONS_API_URL}/opportunity/application/${encodeURIComponent(applicationId)}/payment`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ amount, method, transactionReference }),
        }
      );
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to record payment.");
      }

      const savedPayment = data.application?.payment || data.payment;
      setOpportunityApplicants((current) =>
        current.map((application) =>
          String(application._id) === String(applicationId)
            ? { ...application, payment: savedPayment }
            : application
        )
      );
      setPaymentForms((current) => ({
        ...current,
        [applicationId]: {
          amount: "",
          method: "upi",
          transactionReference: "",
        },
      }));
      setPaymentMessage("Payment record saved. SYNC has not transferred the money itself.");
    } catch (error) {
      setPaymentError(error.message || "Unable to record payment.");
    } finally {
      setPayingApplicationId(null);
    }
  };

  const addDocuments = (event) => {
    const allowedExtensions = /\.(pdf|md|txt|doc|docx|ppt|pptx)$/i;
    const selected = Array.from(event.target.files || []).filter((file) =>
      allowedExtensions.test(file.name)
    );

    setDocuments((current) => [...current, ...selected].slice(0, 5));
    event.target.value = "";
  };

  const toggleLike = (id) => {
    const alreadyLiked = likedPosts.includes(id);

    setLikedPosts((current) =>
      alreadyLiked
        ? current.filter((postId) => postId !== id)
        : [...current, id]
    );

    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? {
              ...post,
              likes: Math.max(
                0,
                post.likes + (alreadyLiked ? -1 : 1)
              ),
            }
          : post
      )
    );
  };

  const sharePost = async (post) => {
    const shareText = [post.title, post.text].filter(Boolean).join("\n\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title || "SYNC post",
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        window.alert("Post text copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        window.alert("Unable to share this post.");
      }
    }
  };

  const toggleFollow = async (targetUserId) => {
    const id = String(targetUserId || "");
    const token = getToken();

    if (!id || !token || followLoadingId) return;

    const isFollowing = followingIds.includes(id);

    setFollowLoadingId(id);

    try {
      const response = await fetch(
        `${FOLLOW_API_URL}/${encodeURIComponent(id)}`,
        {
          method: isFollowing ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to update follow status.");
      }

      setFollowingIds((current) =>
        isFollowing
          ? current.filter((userId) => userId !== id)
          : current.includes(id)
            ? current
            : [...current, id]
      );
    } catch (error) {
      console.error("Follow action error:", error.message);
      window.alert(error.message || "Unable to update follow status.");
    } finally {
      setFollowLoadingId(null);
    }
  };

  const visiblePosts = posts
    .filter((post) => {
      const ownerId = String(post.ownerId || "");
      const isOwnPost = Boolean(currentUserId && ownerId === currentUserId);

      if (
        projectFilter === "Community Projects" &&
        post.type !== "Project"
      ) {
        return false;
      }

      if (
        projectFilter === "Verified Companies" &&
        !(post.role === "Company" && post.isVerified)
      ) {
        return false;
      }

      if (
        projectFilter === "Paid Projects (Compensated)" &&
        !post.isPaid
      ) {
        return false;
      }

      if (
        feedFilter === "Following" &&
        !followingIds.includes(ownerId) &&
        !isOwnPost
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (feedFilter === "Trending") {
        return (b.likes || 0) - (a.likes || 0);
      }

      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

  if (authLoading) {
    return (
      <main className="sync-dashboard">
        <p>Loading your SYNC profile...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="sync-dashboard">
        <section className="sync-panel">
          <h2>Unable to load your profile</h2>
          <p>{authError || "Your profile could not be loaded."}</p>
          <button
            type="button"
            className="sync-primary-button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <button type="button" onClick={handleLogout}>
            Back to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="sync-dashboard">
      <header className="sync-navbar">
        <a className="sync-nav-brand" href="/dashboard">
          <span className="sync-brand-mark">S</span> SYNC
        </a>

        <label className="sync-search">
          <span>⌕</span>
          <input
            placeholder="Search people, posts, projects..."
            aria-label="Search people, posts, and projects"
          />
        </label>

        <nav className="sync-nav-links">
          <a className="selected" href="/dashboard">
            <span>⌂</span>
            <small>Home</small>
          </a>
          <a href="#network">
            <span>♧</span>
            <small>Network</small>
          </a>
          <a href="#projects">
            <span>▤</span>
            <small>Projects</small>
          </a>
          <a href="#profile">
            <span>♙</span>
            <small>Profile</small>
          </a>
        </nav>

        <button
          type="button"
          className="sync-secondary-button"
          onClick={handleLogout}
        >
          Log out
        </button>
      </header>

      <div className="sync-dashboard-layout">
        <aside className="sync-left-sidebar">
          <section className="sync-panel">
            <div className="sync-profile-cover" />

            <div className="sync-profile-info" id="profile">
              <div className="sync-avatar sync-profile-avatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <h2>{user.name || "SYNC member"}</h2>
              <p>
                {user.role === "company"
                  ? "Company"
                  : "Individual · SYNC Member"}
              </p>
              <span>Welcome to your SYNC community.</span>
            </div>

            <div className="sync-profile-stat">
              <span>My projects</span>
              <strong>
                {
                  posts.filter(
                    (post) =>
                      post.type === "Project" &&
                      post.ownerId &&
                      currentUserId &&
                      String(post.ownerId) === currentUserId
                  ).length
                }
              </strong>
            </div>

            <div className="sync-profile-stat">
              <span>My applications</span>
              <strong>{myApplications.length}</strong>
            </div>
          </section>

          <section className="sync-panel sync-sidebar-menu">
            <a href="#projects">▧ &nbsp; My projects</a>
            <a href="#saved">▣ &nbsp; Saved posts</a>
            <a href="#network">♧ &nbsp; My network</a>
            <button
              type="button"
              className="sync-sidebar-action"
              onClick={loadMyApplications}
            >
              ✉ &nbsp; My applications
            </button>
          </section>
        </aside>

        <main className="sync-main-feed" id="projects">
          {showProjectForm && (
            <section className="sync-panel sync-project-form-panel">
              <div className="sync-project-form-heading">
                <div>
                  <h2>Post a Project</h2>
                  <p>
                    Share the details, skills needed, and collaboration
                    opportunities.
                  </p>
                </div>

                <button
                  type="button"
                  className="sync-more-button"
                  onClick={() => {
                    setShowProjectForm(false);
                    resetForm();
                  }}
                  aria-label="Close project form"
                >
                  ✕
                </button>
              </div>

              {user.role === "company" && (
                <p className="sync-form-message">
                  Company opportunities should be published from the company
                  dashboard.
                </p>
              )}

              <form onSubmit={publishProject}>
                <label className="sync-field-label">Project title *</label>
                <input
                  className="sync-text-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. AI-powered career platform"
                  maxLength={100}
                  required
                />

                <label className="sync-field-label">
                  Project description *
                </label>
                <textarea
                  className="sync-text-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does your project do? What problem does it solve?"
                  rows={5}
                  maxLength={3000}
                  required
                />

                <label className="sync-field-label">Project thumbnail</label>
                <label className="sync-upload-card">
                  <input
                    ref={thumbnailRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) =>
                      setThumbnail(event.target.files?.[0] || null)
                    }
                  />
                  <span className="sync-upload-icon">▧</span>
                  <span>
                    <strong>Cover image or screenshot</strong>
                    <small>Choose an image to preview it here</small>
                  </span>
                  <span className="sync-upload-action">Choose</span>
                </label>

                {thumbnail && (
                  <div className="sync-thumbnail-preview">
                    <img
                      src={URL.createObjectURL(thumbnail)}
                      alt="Project preview"
                    />
                    <strong>{thumbnail.name}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnail(null);
                        if (thumbnailRef.current) {
                          thumbnailRef.current.value = "";
                        }
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => thumbnailRef.current?.click()}
                    >
                      Replace
                    </button>
                  </div>
                )}

                <label className="sync-field-label">
                  Documents and README files
                </label>
                <label className="sync-upload-card">
                  <input
                    ref={documentRef}
                    type="file"
                    accept=".pdf,.md,.txt,.doc,.docx,.ppt,.pptx"
                    multiple
                    onChange={addDocuments}
                  />
                  <span className="sync-upload-icon">▤</span>
                  <span>
                    <strong>Attach project documents</strong>
                    <small>PDF, README, DOCX, PPTX · up to 5 files</small>
                  </span>
                  <span className="sync-upload-action">Add files</span>
                </label>

                {documents.map((file, index) => (
                  <div
                    className="sync-attachment"
                    key={`${file.name}-${index}`}
                  >
                    <span>▤</span>
                    <div>
                      <strong>{file.name}</strong>
                      <small>{formatSize(file.size)}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDocuments((current) =>
                          current.filter((_, i) => i !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <label className="sync-field-label">Tech stack and skills</label>
                <input
                  className="sync-text-input"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="React, Node.js, Python (comma-separated)"
                />

                <label className="sync-field-label">Roles needed</label>
                <input
                  className="sync-text-input"
                  value={rolesNeeded}
                  onChange={(event) => setRolesNeeded(event.target.value)}
                  placeholder="Frontend Developer, UI/UX Designer"
                />

                <label className="sync-field-label">Experience level</label>
                <select
                  className="sync-text-input"
                  value={experience}
                  onChange={(event) => setExperience(event.target.value)}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>

                <label className="sync-field-label">
                  GitHub repository URL
                </label>
                <input
                  className="sync-text-input"
                  type="url"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder="https://github.com/username/repository"
                />

                <div className="sync-privacy-box">
                  <strong>Repository access</strong>
                  <p>Choose how you intend to share your repository.</p>
                  <select
                    className="sync-text-input"
                    value={githubVisibility}
                    onChange={(event) =>
                      setGithubVisibility(event.target.value)
                    }
                  >
                    <option value="private">Private — only me</option>
                    <option value="shared">Grant access after approval</option>
                    <option value="public">Public repository</option>
                  </select>
                  <small>
                    This setting does not change GitHub permissions. Actual
                    access control requires GitHub integration.
                  </small>
                </div>

                <label className="sync-checkbox-row">
                  <input
                    type="checkbox"
                    checked={openToCollaborators}
                    onChange={(event) =>
                      setOpenToCollaborators(event.target.checked)
                    }
                  />
                  <span>
                    <strong>Open to collaborators</strong>
                    <small>
                      Let interested people request to join this project.
                    </small>
                  </span>
                </label>

                {message && (
                  <p className="sync-form-message" role="alert">
                    {message}
                  </p>
                )}

                <div className="sync-composer-bottom">
                  <button
                    type="button"
                    className="sync-secondary-button"
                    disabled={publishing}
                    onClick={() => {
                      setShowProjectForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="sync-primary-button"
                    type="submit"
                    disabled={publishing}
                  >
                    {publishing ? "Publishing..." : "Publish Project"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {showMyApplications && (
            <section className="sync-panel sync-post-card" id="applications">
              <div className="sync-project-form-heading">
                <div>
                  <h2>My Applications</h2>
                  <p>Track your project collaboration requests and company opportunity applications.</p>
                </div>
                <button
                  type="button"
                  className="sync-more-button"
                  onClick={() => setShowMyApplications(false)}
                  aria-label="Close applications"
                >
                  ✕
                </button>
              </div>

              {myApplicationsLoading ? (
                <p>Loading your applications...</p>
              ) : myApplicationsError ? (
                <p role="alert">{myApplicationsError}</p>
              ) : myApplications.length === 0 ? (
                <p>You haven't submitted any applications yet.</p>
              ) : (
                myApplications.map((application) => (
                  <div
                    className="sync-application-item"
                    key={application._id}
                  >
                    <h3>
                      {application.opportunity?.title || application.project?.title || "Application"}
                    </h3>
                    <p>{application.opportunity ? "Company opportunity" : "Project collaboration"}</p>
                    <p>{application.message}</p>
                    <p>
                      Status:{" "}
                      <strong
                        className={`sync-status sync-status-${application.status}`}
                      >
                        {application.status}
                      </strong>
                    </p>
                    {application.opportunity && application.status === "accepted" && (
                      <p className="sync-payment-status">
                        Payment: <strong>{application.payment?.status === "paid" ? `₹${Number(application.payment.amount || 0).toLocaleString("en-IN")} recorded as paid` : "Accepted — payment not recorded yet"}</strong>
                        {application.payment?.status === "paid" && application.payment.transactionReference && (
                          <span> · Reference: {application.payment.transactionReference}</span>
                        )}
                      </p>
                    )}
                    <small>
                      Applied {formatTime(application.createdAt)}
                    </small>
                  </div>
                ))
              )}
            </section>
          )}

          {applicationNotice && (
            <section className="sync-panel sync-post-card" role="status">
              <p>{applicationNotice}</p>
              <button
                type="button"
                className="sync-secondary-button"
                onClick={() => setApplicationNotice("")}
              >
                Dismiss
              </button>
            </section>
          )}

          {managedProjectId && (
            <section className="sync-panel sync-post-card">
              <div className="sync-project-form-heading">
                <div>
                  <h2>Project Applicants</h2>
                  <p>
                    Review people who want to contribute to your project.
                  </p>
                </div>
                <button
                  type="button"
                  className="sync-more-button"
                  onClick={() => {
                    setManagedProjectId(null);
                    setManagedApplications([]);
                    setManagedApplicationsError("");
                  }}
                  aria-label="Close project applicants"
                >
                  ✕
                </button>
              </div>

              {managedApplicationsLoading ? (
                <p>Loading applicants...</p>
              ) : managedApplicationsError ? (
                <p role="alert">{managedApplicationsError}</p>
              ) : managedApplications.length === 0 ? (
                <p>No one has applied to this project yet.</p>
              ) : (
                managedApplications.map((application) => (
                  <div
                    className="sync-application-item"
                    key={application._id}
                  >
                    <h3>
                      {application.applicant?.name || "SYNC member"}
                    </h3>
                    <p>{application.applicant?.role || "Contributor"}</p>
                    {application.applicant?.email && (
                      <p>{application.applicant.email}</p>
                    )}
                    {application.applicant?.bio && (
                      <p>{application.applicant.bio}</p>
                    )}
                    <p>{application.message}</p>
                    
<p>
  Status:{" "}
  <strong
    className={`sync-status sync-status-${application.status}`}
  >
    {application.status === "rejected"
      ? "Rejected"
      : application.status === "accepted"
        ? "Accepted"
        : "Pending"}
  </strong>
</p>


                    {application.status === "pending" && (
                      <div className="sync-composer-bottom">
                        <button
                          type="button"
                          className="sync-secondary-button"
                          disabled={reviewingApplication === application._id}
                          onClick={() =>
                            reviewApplication(application._id, "rejected")
                          }
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="sync-primary-button"
                          disabled={reviewingApplication === application._id}
                          onClick={() =>
                            reviewApplication(application._id, "accepted")
                          }
                        >
                          {reviewingApplication === application._id
                            ? "Updating..."
                            : "Accept"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          {managedOpportunityId && (
            <section className="sync-panel sync-post-card">
              <div className="sync-project-form-heading">
                <div>
                  <h2>Opportunity Applicants</h2>
                  <p>Review candidates who applied to your company opportunity.</p>
                </div>
                <button
                  type="button"
                  className="sync-more-button"
                  onClick={() => {
                    setManagedOpportunityId(null);
                    setOpportunityApplicants([]);
                    setOpportunityApplicantsError("");
                  }}
                  aria-label="Close opportunity applicants"
                >
                  ✕
                </button>
              </div>

              {opportunityApplicantsLoading ? (
                <p>Loading applicants...</p>
              ) : opportunityApplicantsError ? (
                <p role="alert">{opportunityApplicantsError}</p>
              ) : opportunityApplicants.length === 0 ? (
                <p>No one has applied to this opportunity yet.</p>
              ) : (
                opportunityApplicants.map((application) => (
                  <div className="sync-application-item" key={application._id}>
                    <h3>{application.applicant?.name || "SYNC member"}</h3>
                    {application.applicant?.email && <p>{application.applicant.email}</p>}
                    {application.applicant?.role && <p>{application.applicant.role}</p>}
                    {application.applicant?.bio && <p>{application.applicant.bio}</p>}
                    <p>{application.message}</p>
                    <p>
                      Status: <strong className={`sync-status sync-status-${application.status}`}>
                        {application.status || "pending"}
                      </strong>
                    </p>
                    <small>Applied {formatTime(application.createdAt)}</small>
                    {application.status === "pending" && (
                      <div className="sync-composer-bottom">
                        <button
                          type="button"
                          className="sync-secondary-button"
                          disabled={reviewingApplication === application._id}
                          onClick={() => reviewOpportunityApplication(application._id, "rejected")}
                        >Reject</button>
                        <button
                          type="button"
                          className="sync-primary-button"
                          disabled={reviewingApplication === application._id}
                          onClick={() => reviewOpportunityApplication(application._id, "accepted")}
                        >
                          {reviewingApplication === application._id ? "Updating..." : "Accept"}
                        </button>
                      </div>
                    )}

                    {application.status === "accepted" && (
                      <div className="sync-payment-panel">
                        <div className="sync-payment-heading">
                          <h4>Collaborator payment</h4>
                          <span className={`sync-payment-status ${application.payment?.status === "paid" ? "is-paid" : "is-unpaid"}`}>
                            {application.payment?.status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        {application.payment?.status === "paid" ? (
                          <div className="sync-payment-receipt">
                            <p><strong>Amount:</strong> ₹{Number(application.payment.amount || 0).toLocaleString("en-IN")}</p>
                            <p><strong>Method:</strong> {application.payment.method === "bank_transfer" ? "Bank transfer" : "UPI"}</p>
                            <p><strong>Transaction reference:</strong> {application.payment.transactionReference}</p>
                            {application.payment.paidAt && <p><strong>Paid on:</strong> {new Date(application.payment.paidAt).toLocaleDateString("en-IN")}</p>}
                          </div>
                        ) : (
                          <div className="sync-payment-form">
                            <label className="sync-field-label">
                              Payment amount (₹)
                              <input
                                className="sync-text-input"
                                type="number"
                                min="0.01"
                                max="10000000"
                                step="0.01"
                                placeholder="Enter amount"
                                value={paymentForms[application._id]?.amount || ""}
                                onChange={(event) => setPaymentForms((current) => ({
                                  ...current,
                                  [application._id]: {
                                    ...current[application._id],
                                    amount: event.target.value,
                                  },
                                }))}
                              />
                            </label>
                            <label className="sync-field-label">
                              Payment method
                              <select
                                className="sync-text-input"
                                value={paymentForms[application._id]?.method || "upi"}
                                onChange={(event) => setPaymentForms((current) => ({
                                  ...current,
                                  [application._id]: {
                                    ...current[application._id],
                                    method: event.target.value,
                                  },
                                }))}
                              >
                                <option value="upi">UPI</option>
                                <option value="bank_transfer">Bank transfer</option>
                              </select>
                            </label>
                            <label className="sync-field-label">
                              Transaction reference / UTR
                              <input
                                className="sync-text-input"
                                type="text"
                                minLength={4}
                                maxLength={100}
                                placeholder="Enter reference after transfer"
                                value={paymentForms[application._id]?.transactionReference || ""}
                                onChange={(event) => setPaymentForms((current) => ({
                                  ...current,
                                  [application._id]: {
                                    ...current[application._id],
                                    transactionReference: event.target.value,
                                  },
                                }))}
                              />
                            </label>
                            {paymentError && <p className="sync-form-message" role="alert">{paymentError}</p>}
                            {paymentMessage && <p className="sync-form-message" role="status">{paymentMessage}</p>}
                            <button
                              type="button"
                              className="sync-primary-button"
                              disabled={payingApplicationId === application._id}
                              onClick={() => recordCollaboratorPayment(application._id)}
                            >
                              {payingApplicationId === application._id ? "Recording payment..." : "Record payment after transfer"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          <div className="sync-feed-heading">
            <h1>Your feed</h1>
            <button
              type="button"
              className="sync-secondary-button"
              onClick={loadFeed}
              disabled={projectsLoading}
            >
              {projectsLoading ? "Refreshing..." : "Refresh feed"}
            </button>
          </div>

          <div className="sync-feed-filters">
            <div className="sync-filter-row">
              {["For You", "Latest", "Trending", "Following"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`sync-filter-tab ${
                    feedFilter === item ? "active" : ""
                  }`}
                  onClick={() => setFeedFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="sync-filter-row sync-project-filter-row">
              {[
                "All Projects",
                "Community Projects",
                "Verified Companies",
                "Paid Projects (Compensated)",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`sync-filter-chip ${
                    projectFilter === item ? "active" : ""
                  }`}
                  onClick={() => setProjectFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {projectError && (
            <section className="sync-panel sync-post-card">
              <p role="alert">{projectError}</p>
              <button
                type="button"
                className="sync-secondary-button"
                onClick={loadFeed}
                disabled={projectsLoading}
              >
                Retry
              </button>
            </section>
          )}

          {projectsLoading ? (
            <section className="sync-panel sync-post-card">
              <p>Loading projects and company opportunities...</p>
            </section>
          ) : visiblePosts.length === 0 ? (
            <section className="sync-panel sync-post-card">
              <p>No posts found in this category yet.</p>
              <p>
                Check another filter or be the first to share something with
                the SYNC community.
              </p>
            </section>
          ) : (
            visiblePosts.map((post) => {
              const isOwnPost =
                Boolean(currentUserId) &&
                String(post.ownerId) === currentUserId;

              return (
                <article
                  className="sync-panel sync-post-card"
                  key={`${post.type}-${post.id}`}
                >
                  <div className="sync-post-header">
                    <div className="sync-avatar">
                      {post.author?.charAt(0).toUpperCase() || "S"}
                    </div>

                    <div className="sync-post-author">
                      <h3>{post.author}</h3>
                      <p>
                        {post.role}
                        {post.role === "Company" && post.isVerified
                          ? " · Verified"
                          : ""}
                      </p>
                      <span>
                        {post.time} · {post.type}
                      </span>
                    </div>

                    {post.ownerId && !isOwnPost && (
                      <button
                        type="button"
                        className={`sync-follow-button ${
                          followingIds.includes(String(post.ownerId))
                            ? "is-following"
                            : ""
                        }`}
                        disabled={followLoadingId === String(post.ownerId)}
                        onClick={() => toggleFollow(post.ownerId)}
                      >
                        {followLoadingId === String(post.ownerId)
                          ? "Please wait..."
                          : followingIds.includes(String(post.ownerId))
                            ? "Following"
                            : "Follow"}
                      </button>
                    )}

                    <div className="sync-post-menu">
                      <button
                        className="sync-more-button"
                        type="button"
                        onClick={() =>
                          setOpenPostMenu((current) =>
                            current === post.id ? null : post.id
                          )
                        }
                        aria-label="Post options"
                        aria-expanded={openPostMenu === post.id}
                      >
                        ···
                      </button>

                      {openPostMenu === post.id && (
                        <div className="sync-post-menu-dropdown">
                          {isOwnPost && post.type === "Project" ? (
                            <button
                              type="button"
                              className="sync-post-menu-delete"
                              onClick={() => deleteProject(post)}
                            >
                              Delete project
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOpenPostMenu(null)}
                            >
                              Close menu
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {post.title && (
                    <h2 className="sync-post-title">{post.title}</h2>
                  )}

                  {post.text && (
                    <p className="sync-post-text">{post.text}</p>
                  )}

{post.type === "Opportunity" && (
  <div className="sync-opportunity-details">
    <div className="sync-opportunity-meta">
      <span>
        {post.opportunityType === "internship"
          ? "Internship"
          : post.opportunityType === "project"
            ? "Company Project"
            : post.opportunityType === "job"
              ? "Job"
              : post.opportunityType}
      </span>

      <span>{post.location}</span>
      <span>{post.workMode}</span>

      {post.employmentType && (
        <span>{post.employmentType}</span>
      )}
    </div>

    <p className="sync-project-meta">
      Experience: {post.experience}
    </p>

    {(post.salaryMin !== null || post.salaryMax !== null) && (
      <p className="sync-project-meta">
        Compensation:{" "}
        {post.salaryMin !== null
          ? `${post.currency} ${post.salaryMin}`
          : "Not specified"}
        {post.salaryMax !== null
          ? ` – ${post.currency} ${post.salaryMax}`
          : ""}
      </p>
    )}

    {post.deadline && (
      <p className="sync-project-meta">
        Apply by: {new Date(post.deadline).toLocaleDateString()}
      </p>
    )}

    <div className="sync-opportunity-apply">
      {!isOwnPost && currentUserId && (
        <button
          type="button"
          className="sync-primary-button"
          onClick={() => applyToOpportunity(post)}
        >
          <span>＋</span> Apply to Opportunity
        </button>
      )}

      {isOwnPost && user.role === "company" && (
        <button
          type="button"
          className="sync-primary-button"
          onClick={() => loadOpportunityApplicants(post.id)}
        >
          View applicants
        </button>
      )}
    </div>
  </div>
)}

                  {post.type === "Opportunity" &&
                    applyingToOpportunity === post.id && (
                      <form
                        className="sync-application-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitOpportunityApplication(post.id);
                        }}
                      >
                        <label
                          className="sync-field-label"
                          htmlFor={`opportunity-application-${post.id}`}
                        >
                          Why are you a good fit for this opportunity?
                        </label>
                        <textarea
                          id={`opportunity-application-${post.id}`}
                          className="sync-text-input"
                          rows={4}
                          maxLength={1000}
                          value={opportunityApplicationMessage}
                          onChange={(event) =>
                            setOpportunityApplicationMessage(event.target.value)
                          }
                          placeholder="Introduce yourself, mention relevant skills, and explain why you're interested..."
                        />
                        <small>
                          {opportunityApplicationMessage.length}/1000 characters (minimum 20)
                        </small>
                        {opportunityApplicationError && (
                          <p className="sync-form-message" role="alert">
                            {opportunityApplicationError}
                          </p>
                        )}
                        <div className="sync-composer-bottom">
                          <button
                            type="button"
                            className="sync-secondary-button"
                            disabled={submittingOpportunityApplication}
                            onClick={() => {
                              setApplyingToOpportunity(null);
                              setOpportunityApplicationMessage("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="sync-primary-button"
                            disabled={submittingOpportunityApplication}
                          >
                            {submittingOpportunityApplication
                              ? "Submitting..."
                              : "Submit application"}
                          </button>
                        </div>
                      </form>
                    )}

                  {post.thumbnail && (
                    <img
                      className="sync-post-thumbnail"
                      src={post.thumbnail}
                      alt="Project cover"
                    />
                  )}

                  {post.tags?.length > 0 && (
                    <div className="sync-post-tags">
                      {post.tags.map((tag, index) => (
                        <span key={`${tag}-${index}`}>#{tag}</span>
                      ))}
                    </div>
                  )}

                  {post.type === "Project" && post.experience && (
                    <p className="sync-project-meta">
                      Experience: {post.experience}
                    </p>
                  )}

                  {post.rolesNeeded?.length > 0 && (
                    <div className="sync-project-roles">
                      <strong>Looking for:</strong>
                      {post.rolesNeeded.map((role, index) => (
                        <span key={`${role}-${index}`}>{role}</span>
                      ))}
                    </div>
                  )}

                  {post.attachments?.map((file, index) => (
                    <div
                      className="sync-attachment"
                      key={`${file.name}-${index}`}
                    >
                      <span>▤</span>
                      <div>
                        <strong>{file.name}</strong>
                        <small>{file.size}</small>
                        {file.url && (
                          <a href={file.url} download={file.name}>
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {post.type === "Project" &&
                    post.openToCollaborators && (
                      <p className="sync-collab-note">
                        ＋ Open to collaboration
                      </p>
                    )}

                  {post.hasPrivateGithubLink &&
                    post.githubVisibility !== "public" && (
                      <p className="sync-private-note">
                        Repository access is restricted
                      </p>
                    )}

                  <div className="sync-post-stats">
                    <span>{post.likes} likes</span>
                    <span>{post.comments} comments</span>
                  </div>

                  <div className="sync-post-actions">
                    <button
                      type="button"
                      className={likedPosts.includes(post.id) ? "liked" : ""}
                      onClick={() => toggleLike(post.id)}
                    >
                      <span>♡</span> Like
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        window.alert("Comment feature coming next.")
                      }
                    >
                      <span>▢</span> Comment
                    </button>

                    <button
                      type="button"
                      onClick={() => sharePost(post)}
                    >
                      <span>↗</span> Share
                    </button>

                   
{post.type === "Project" &&
  post.openToCollaborators &&
  currentUserId &&
  !isOwnPost && (
    <button
      type="button"
      className="sync-primary-button"
      onClick={() => {
        setApplicationNotice("");
        setApplyingTo((current) =>
          current === post.id ? null : post.id
        );
      }}
    >
      <span>＋</span> Collaborate
    </button>
  )}


                    {post.type === "Project" && isOwnPost && (
                      <button
                        type="button"
                        onClick={() => loadProjectApplications(post.id)}
                      >
                        <span>♧</span> View applicants
                      </button>
                    )}

                    {!collaborationAccessLoading &&
                      post.type === "Project" &&
                      post.id &&
                      currentUserId &&
                      (isOwnPost ||
                        collaborationProjectIds.includes(
                          String(post.id)
                        )) && (
                        <button
                          type="button"
                          className="sync-primary-button"
                          onClick={() => {
                            window.location.href = `/collaboration/${encodeURIComponent(
                              post.id
                            )}`;
                          }}
                        >
                          <span>▤</span> Open Collaboration Dashboard
                        </button>
                      )}
                  </div>

                  {applyingTo === post.id &&
                    post.type === "Project" && (
                      <form
                        className="sync-application-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitApplication(post.id);
                        }}
                      >
                        <label
                          className="sync-field-label"
                          htmlFor={`application-${post.id}`}
                        >
                          Why do you want to join this project?
                        </label>

                        <textarea
                          id={`application-${post.id}`}
                          className="sync-text-input"
                          rows={4}
                          minLength={20}
                          maxLength={1000}
                          required
                          value={applicationMessages[post.id] || ""}
                          onChange={(event) =>
                            setApplicationMessages((current) => ({
                              ...current,
                              [post.id]: event.target.value,
                            }))
                          }
                          placeholder="Introduce yourself, explain your relevant skills, and how you can contribute..."
                        />

                        <small>
                          {(applicationMessages[post.id] || "").length}/1000
                          characters (minimum 20)
                        </small>

                        <div className="sync-composer-bottom">
                          <button
                            type="button"
                            className="sync-secondary-button"
                            onClick={() => setApplyingTo(null)}
                            disabled={submittingApplication}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="sync-primary-button"
                            disabled={submittingApplication}
                          >
                            {submittingApplication
                              ? "Submitting..."
                              : "Submit application"}
                          </button>
                        </div>
                      </form>
                    )}
                </article>
              );
            })
          )}
        </main>

        <aside className="sync-right-sidebar">
          <section className="sync-panel sync-trending-panel">
            <h2>Trending in SYNC</h2>
            <p className="sync-sidebar-subtitle">Topics worth exploring</p>

            {[
              ["#BuildInPublic", "Share your progress"],
              ["#ArtificialIntelligence", "AI ideas and projects"],
              ["#OpenSource", "Build with the community"],
              ["#WebDevelopment", "Web projects and skills"],
            ].map(([topic, subtitle]) => (
              <a
                className="sync-trending-item"
                href="#community"
                key={topic}
              >
                <strong>{topic}</strong>
                <span>{subtitle}</span>
              </a>
            ))}

            <a className="sync-see-more" href="#community">
              Explore community →
            </a>
          </section>

          <section className="sync-panel sync-build-panel">
            <span className="sync-build-label">YOUR NEXT STEP</span>
            <h2>Have an idea?</h2>
            <p>
              Share your project with the community and find people who want
              to build it with you.
            </p>
            {user.role !== "company" && (
              <button
                type="button"
                className="sync-primary-button"
                onClick={() => {
                  setMessage("");
                  setShowProjectForm(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                + Post a Project
              </button>
            )}
          </section>

          <footer className="sync-mini-footer">
            <a href="#about">About</a>
            <a href="#guidelines">Community guidelines</a>
            <span>© 2026 SYNC</span>
          </footer>
        </aside>
      </div>
    </div>
  );
}
