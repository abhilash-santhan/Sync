
import React, { useState } from "react";

const API_URL = "http://localhost:3001/api/auth";

export default function Signup() {
  const [accountType, setAccountType] = useState("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();
    setMessage("");

    if (name.trim().length < 2) {
      setMessage("Name must contain at least 2 characters.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: accountType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to create your account.");
        return;
      }

      // Store the session if the registration endpoint returns a JWT.
      if (data.token && data.user) {
        sessionStorage.setItem("syncToken", data.token);
        sessionStorage.setItem("syncUser", JSON.stringify(data.user));
        window.location.href = "/dashboard";
        return;
      }

      // Handle a successful registration if no token was returned.
      setMessage("Account created successfully! Please log in.");
    } catch (error) {
      setMessage(
        "Unable to connect to SYNC. Make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="simple-signup-page">
      <header className="simple-signup-header">
        <a className="simple-signup-brand" href="/">
          <span className="simple-signup-mark">S</span>
          SYNC
        </a>

        <p>
          Already a member? <a href="/">Log in</a>
        </p>
      </header>

      <section className="simple-signup-card">
        <div className="simple-signup-heading">
          <span>GET STARTED</span>
          <h1>Create your account</h1>
          <p>Join SYNC and start building together.</p>
        </div>

        <form onSubmit={handleSignup} className="simple-signup-form">
          <fieldset className="simple-account-fieldset">
            <legend>I want to join as</legend>

            <div className="simple-account-types">
              <button
                type="button"
                className={accountType === "individual" ? "active" : ""}
                onClick={() => setAccountType("individual")}
                aria-pressed={accountType === "individual"}
              >
                Individual
              </button>

              <button
                type="button"
                className={accountType === "company" ? "active" : ""}
                onClick={() => setAccountType("company")}
                aria-pressed={accountType === "company"}
              >
                Company
              </button>
            </div>
          </fieldset>

          <div className="simple-signup-field">
            <label htmlFor="signup-name">
              {accountType === "individual" ? "Full name" : "Company name"}
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder={
                accountType === "individual"
                  ? "Enter your full name"
                  : "Enter your company name"
              }
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <div className="simple-signup-field">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="simple-signup-field">
            <label htmlFor="signup-password">Password</label>
            <div className="simple-signup-password">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="simple-signup-field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Enter password again"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          {message && (
            <p className="simple-signup-message" role="status">
              {message}
            </p>
          )}

          <button
            className="simple-signup-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>
        </form>

        <p className="simple-signup-terms">
          By creating an account, you agree to use SYNC responsibly.
        </p>
      </section>

      <footer className="simple-signup-footer">
        © 2026 SYNC · Connect. Collaborate. Create.
      </footer>
    </main>
  );
}
