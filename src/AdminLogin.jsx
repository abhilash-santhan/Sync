
import { useState } from "react";

const API = "http://localhost:3001/api/admin";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
  
    try {
      const response = await fetch("http://localhost:3001/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || `Login failed (${response.status})`);
      }
  
      if (!data.token) {
        throw new Error("Login succeeded, but the server did not return a token.");
      }
  
      sessionStorage.setItem("syncAdminToken", data.token);
      window.location.assign("/admin/dashboard");
    } catch (err) {
      console.error("Admin login error:", err);
      setError(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }
  

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.logo}>S</div>
        <h1 style={styles.title}>SYNC Admin</h1>
        <p style={styles.subtitle}>
          Company verification and platform administration
        </p>

        <label style={styles.label} htmlFor="admin-email">
          Admin email
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />

        <label style={styles.label} htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />

        {error && <p role="alert" style={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Signing in..." : "Sign in to Admin"}
        </button>

        <p style={styles.note}>
          Restricted access. Only authorized administrators may sign in.
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#F6F8FA",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    boxSizing: "border-box",
    padding: 32,
    background: "#FFFFFF",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(27,73,101,0.10)",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#1B4965",
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: 700,
  },
  title: { color: "#1B4965", marginBottom: 8 },
  subtitle: { color: "#607080", lineHeight: 1.5, marginBottom: 28 },
  label: {
    display: "block",
    color: "#1B4965",
    fontWeight: 600,
    margin: "16px 0 8px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    border: "1px solid #D9E3EA",
    borderRadius: 8,
    fontSize: 15,
  },
  button: {
    width: "100%",
    padding: 14,
    marginTop: 24,
    border: "none",
    borderRadius: 8,
    background: "#1B4965",
    color: "#FFFFFF",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: { color: "#B42318", fontSize: 14 },
  note: { color: "#687987", fontSize: 12, lineHeight: 1.5, marginTop: 20 },
};
