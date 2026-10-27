import React, { useState } from "react";

const API_URL = "http://localhost:3001/api/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check administrator login first.
      const adminResponse = await fetch(
        "http://localhost:3001/api/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        }
      );

      const adminData = await adminResponse.json();

      if (adminResponse.ok) {
        if (!adminData.token) {
          throw new Error("Admin login response did not include a token.");
        }

        sessionStorage.removeItem("syncToken");
        sessionStorage.removeItem("syncUser");
        sessionStorage.setItem("syncAdminToken", adminData.token);

        window.location.href = "/admin/dashboard";
        return;
      }

      if (adminResponse.status !== 401) {
        throw new Error(
          adminData.message || "Unable to verify login. Please try again."
        );
      }

      // Try normal SYNC user login.
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Invalid email or password.");
        return;
      }

      if (!data.token || !data.user) {
        setMessage("Login response was incomplete. Please try again.");
        return;
      }

      // Clear any previous administrator session.
      sessionStorage.removeItem("syncAdminToken");

      sessionStorage.setItem("syncToken", data.token);
      sessionStorage.setItem("syncUser", JSON.stringify(data.user));
      console.log("LOGIN ROLE:", data.user.role);
console.log(
  "REDIRECTING TO:",
  data.user.role === "company" ? "/company/dashboard" : "/dashboard"
);
      // Redirect according to the account role.
      if (data.user.role === "company") {
        window.location.href = "/company/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error("SYNC login error:", error);
      setMessage(
        error.message ||
          "Unable to connect to SYNC. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword(event) {
    event.preventDefault();
    setMessage(
      "Password reset is not available yet. Please contact support or use an existing account password."
    );
  }

  return (
    <main className="sync-login-page">
      <header className="sync-login-header">
        <a className="sync-login-brand" href="/" aria-label="SYNC home">
          <span className="sync-brand-mark">S</span>
          <span>SYNC</span>
        </a>

        <p className="sync-header-prompt">
          New to SYNC? <a href="/signup">Create an account</a>
        </p>
      </header>

      <section className="sync-login-layout">
        <div className="sync-login-intro">
          <span className="sync-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>

          <h1 className="sync-slogan">
            <span className="sync-slogan-line">Build together.</span>
            <span className="sync-slogan-line sync-slogan-highlight">
              Go further.
            </span>
          </h1>

          <p className="sync-login-description">
            Find your people, discover meaningful opportunities, and turn
            ambitious ideas into real projects.
          </p>

          <div className="sync-login-benefits">
            <div className="sync-benefit">
              <span className="sync-benefit-number">01</span>
              <div>
                <strong>Discover opportunities</strong>
                <p>Explore projects, internships, and jobs.</p>
              </div>
            </div>

            <div className="sync-benefit">
              <span className="sync-benefit-number">02</span>
              <div>
                <strong>Meet your people</strong>
                <p>Connect with people who share your vision.</p>
              </div>
            </div>

            <div className="sync-benefit">
              <span className="sync-benefit-number">03</span>
              <div>
                <strong>Create something meaningful</strong>
                <p>Turn great ideas into real-world work.</p>
              </div>
            </div>
          </div>
        </div>

        <section className="sync-login-card">
          <div className="sync-login-card-heading">
            <span className="sync-login-step">WELCOME BACK</span>
            <h2>Log in to SYNC</h2>
            <p>Pick up where your next big idea begins.</p>
          </div>

          <form className="sync-login-form" onSubmit={handleLogin}>
            <div className="sync-login-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="sync-login-field">
              <div className="sync-password-label-row">
                <label htmlFor="login-password">Password</label>
                <a href="#forgot-password" onClick={handleForgotPassword}>
                  Forgot password?
                </a>
              </div>

              <div className="sync-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  type="button"
                  className="sync-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {message && (
              <p className="sync-login-message" role="status">
                {message}
              </p>
            )}

            <button
              className="sync-login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log in"}
              {!loading && <span aria-hidden="true"> →</span>}
            </button>

            <p className="sync-login-terms">
              By continuing, you agree to use SYNC responsibly.
            </p>
          </form>

          <div className="sync-login-divider">
            <span>NEW TO THE COMMUNITY?</span>
          </div>

          <a className="sync-create-account" href="/signup">
            Create your SYNC account <span aria-hidden="true">↗</span>
          </a>
        </section>
      </section>

      <footer className="sync-login-footer">
        <span>© 2026 SYNC</span>
        <span>Connect. Collaborate. Create.</span>
      </footer>
    </main>
  );
}
