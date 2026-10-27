
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:3001/api/admin";

export default function AdminDashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const token = sessionStorage.getItem("syncAdminToken");

  const loadApplications = useCallback(async () => {
    if (!token) {
      window.location.replace("/admin/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/applications?status=pending`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("syncAdminToken");
        window.location.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to load applications");
      }

      setApplications(data.applications || []);
    } catch (err) {
      setError(err.message || "Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function reviewApplication(userId, action) {
    const prompts = {
      approve: "Approve this company's verification?",
      reject: "Reject this company's verification?",
      request_more_info: "Ask this company for more information?",
    };

    if (!window.confirm(prompts[action])) return;

    let note = "";
    if (action !== "approve") {
      note = window.prompt("Enter a review note for the company:") || "";

      if (!note.trim()) {
        setError("A review note is required for this action.");
        return;
      }
    }

    setBusyId(userId);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/applications/${userId}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action, note }),
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("syncAdminToken");
        window.location.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Review action failed");
      }

      setNotice(data.message || "Review saved.");
      await loadApplications();
    } catch (err) {
      setError(err.message || "Unable to save review");
    } finally {
      setBusyId("");
    }
  }

  function logout() {
    sessionStorage.removeItem("syncAdminToken");
    window.location.href = "/admin/login";
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>SYNC / ADMIN</div>
          <h1 style={styles.heading}>Company verification</h1>
          <p style={styles.muted}>
            Review applications before companies can publish opportunities.
          </p>
        </div>
        <button onClick={logout} style={styles.secondaryButton}>
          Log out
        </button>
      </header>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.subheading}>Pending applications</h2>
          <button onClick={loadApplications} style={styles.secondaryButton}>
            Refresh
          </button>
        </div>

        {notice && <p style={styles.success}>{notice}</p>}
        {error && <p role="alert" style={styles.error}>{error}</p>}
        {loading && <p style={styles.muted}>Loading applications...</p>}

        {!loading && !error && applications.length === 0 && (
          <p style={styles.muted}>No pending applications right now.</p>
        )}

        {applications.map((company) => {
          const verification = company.companyVerification || {};

          return (
            <article key={company._id} style={styles.application}>
              <div style={styles.applicationHeader}>
                <div>
                  <h3 style={styles.companyName}>
                    {verification.legalBusinessName || company.name}
                  </h3>
                  <p style={styles.muted}>{company.email}</p>
                </div>
                <span style={styles.badge}>Pending</span>
              </div>

              <dl style={styles.details}>
                <dt>Country</dt>
                <dd>{verification.country || "Not provided"}</dd>

                <dt>Registration number</dt>
                <dd>{verification.registrationNumber || "Not provided"}</dd>

                <dt>Business email</dt>
                <dd>{verification.businessEmail || "Not provided"}</dd>

                <dt>Website</dt>
                <dd>
                  {verification.website ? (
                    <a
                      href={verification.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {verification.website}
                    </a>
                  ) : "Not provided"}
                </dd>

                <dt>Representative</dt>
                <dd>
                  {verification.representativeName || "Not provided"}
                  {verification.representativeRole
                    ? ` — ${verification.representativeRole}`
                    : ""}
                </dd>

                <dt>Submitted</dt>
                <dd>
                  {verification.submittedAt
                    ? new Date(verification.submittedAt).toLocaleString()
                    : "Unknown"}
                </dd>
              </dl>

              {verification.evidenceUrls?.length > 0 && (
                <div>
                  <strong>Evidence links</strong>
                  <ul>
                    {verification.evidenceUrls.map((url, index) => (
                      <li key={`${url}-${index}`}>
                        <a href={url} target="_blank" rel="noreferrer">
                          Evidence {index + 1}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {verification.reviewNote && (
                <p style={styles.muted}>
                  Previous note: {verification.reviewNote}
                </p>
              )}

              <div style={styles.actions}>
                <button
                  disabled={busyId === company._id}
                  onClick={() => reviewApplication(company._id, "approve")}
                  style={styles.primaryButton}
                >
                  Approve
                </button>
                <button
                  disabled={busyId === company._id}
                  onClick={() => reviewApplication(company._id, "request_more_info")}
                  style={styles.secondaryButton}
                >
                  Request information
                </button>
                <button
                  disabled={busyId === company._id}
                  onClick={() => reviewApplication(company._id, "reject")}
                  style={styles.dangerButton}
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F6F8FA",
    padding: "32px 5%",
    fontFamily: "Arial, sans-serif",
    color: "#1B4965",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 28,
  },
  brand: { fontSize: 12, fontWeight: 800, letterSpacing: 2 },
  heading: { margin: "8px 0", fontSize: 30 },
  subheading: { margin: 0, fontSize: 20 },
  muted: { color: "#607080", lineHeight: 1.5 },
  panel: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    boxShadow: "0 4px 20px rgba(27,73,101,0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  application: {
    borderTop: "1px solid #E3EAF0",
    padding: "24px 0",
  },
  applicationHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  companyName: { margin: "0 0 6px", fontSize: 20 },
  badge: {
    height: "fit-content",
    padding: "6px 10px",
    background: "#FFF3D6",
    color: "#805B00",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
  },
  details: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, 180px) minmax(0, 1fr)",
    gap: "10px 16px",
    margin: "20px 0",
    overflowWrap: "anywhere",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
  },
  primaryButton: {
    background: "#1B4965",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "11px 16px",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#FFFFFF",
    color: "#1B4965",
    border: "1px solid #D9E3EA",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  dangerButton: {
    background: "#FFFFFF",
    color: "#B42318",
    border: "1px solid #E7B5B0",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: "pointer",
  },
  success: { color: "#18794E" },
  error: { color: "#B42318" },
};
