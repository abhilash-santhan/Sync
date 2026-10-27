
import React, { useEffect, useState, useCallback } from "react";
import Chatbox from "./Chatbox.jsx";
import "./CollaborationDashboard.css";

const API = "http://localhost:3001";

export default function CollaborationDashboard({ projectId }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const token = sessionStorage.getItem("syncToken");

  const request = useCallback(async (url, options = {}) => {
    const currentToken = sessionStorage.getItem("syncToken");

    if (!currentToken) {
      window.location.href = "/";
      throw new Error("Please log in to access this workspace.");
    }

    const response = await fetch(`${API}${url}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }, []);

  const loadTasks = useCallback(async () => {
    const result = await request(
      `/api/tasks/${encodeURIComponent(projectId)}`
    );

    setTasks(result.tasks || []);
  }, [projectId, request]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setError("");

      try {
        const result = await request(
          `/api/applications/workspace/${encodeURIComponent(projectId)}`
        );

        if (cancelled) return;

        setData(result);

        const taskResult = await request(
          `/api/tasks/${encodeURIComponent(projectId)}`
        );

        if (cancelled) return;

        setTasks(taskResult.tasks || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load the workspace.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [projectId, request]);

  async function createTask(event) {
    event.preventDefault();
    setError("");

    if (data?.access !== "owner") {
      setError("Only the project owner can create tasks.");
      return;
    }

    try {
      await request(`/api/tasks/${encodeURIComponent(projectId)}`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          assignedTo: assignedTo || null,
        }),
      });

      setTitle("");
      setDescription("");
      setAssignedTo("");

      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateStatus(taskId, status) {
    setError("");

    try {
      await request(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="sync-dashboard">
        <section className="sync-panel">
          Loading collaboration workspace...
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sync-dashboard">
        <section className="sync-panel">
          <h2>Unable to open workspace</h2>
          <p role="alert">{error || "Workspace data could not be loaded."}</p>
          <button
            className="sync-secondary-button"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
          >
            Back to Dashboard
          </button>
        </section>
      </div>
    );
  }

  const { project, collaborators = [], access } = data;
  const isOwner = access === "owner";

  return (
    <div className="sync-dashboard">
      <header className="sync-panel">
        <button
          className="sync-secondary-button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        >
          ← Back to Dashboard
        </button>

        <p>{isOwner ? "PROJECT OWNER" : "COLLABORATOR WORKSPACE"}</p>
        <h1>{project.title}</h1>
        <p>{project.description}</p>
        <p>Project status: {project.status || "Active"}</p>

        {project.githubUrl && (
          <p>
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View GitHub Repository ↗
            </a>
          </p>
        )}
      </header>

      <nav className="sync-panel" aria-label="Workspace navigation">
        {["overview", "tasks", "team", "chat"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={
              activeTab === tab
                ? "sync-primary-button"
                : "sync-secondary-button"
            }
            onClick={() => {
              setActiveTab(tab);
              setError("");
            }}
          >
            {tab === "chat" ? "Team Chat" : tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {error && (
        <p className="sync-panel" role="alert">
          {error}
        </p>
      )}

      {activeTab === "overview" && (
        <section className="sync-panel">
          <h2>Project Overview</h2>

          <p>
            {tasks.filter(
              (task) => task.status?.toLowerCase() === "completed"
            ).length}{" "}
            of {tasks.length} tasks completed
          </p>

          <p>Team members: {collaborators.length + 1}</p>

          <button
            className="sync-primary-button"
            onClick={() => setActiveTab("tasks")}
          >
            View Project Tasks
          </button>
        </section>
      )}

      {activeTab === "tasks" && (
        <section className="sync-panel">
          <h2>Project Tasks</h2>

          {isOwner && (
            <form onSubmit={createTask}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task title"
                minLength={3}
                maxLength={100}
                required
              />

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Task description (optional)"
                maxLength={1000}
              />

              <select
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
              >
                <option value="">Unassigned</option>

                {project.owner?._id && (
                  <option value={project.owner._id}>
                    {project.owner.name || project.owner.email} (Owner)
                  </option>
                )}

                {collaborators.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>

              <button className="sync-primary-button" type="submit">
                Create Task
              </button>
            </form>
          )}

          {!isOwner && (
            <p>
              You can view project tasks and update their status.
            </p>
          )}

          {tasks.length === 0 && <p>No tasks yet.</p>}

          {tasks.map((task) => (
            <article key={task._id} className="sync-panel">
              <h3>{task.title}</h3>

              {task.description && <p>{task.description}</p>}

              <p>
                Assigned to:{" "}
                {task.assignedTo?.name ||
                  task.assignedTo?.email ||
                  "Unassigned"}
              </p>

              <label>
                Task status{" "}
                <select
                  value={task.status}
                  onChange={(event) =>
                    updateStatus(task._id, event.target.value)
                  }
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
            </article>
          ))}
        </section>
      )}

      {activeTab === "team" && (
        <section className="sync-panel">
          <h2>Project Team</h2>

          <article className="sync-panel">
            <h3>{project.owner?.name || project.owner?.email || "Project Owner"}</h3>
            <p>Project Owner</p>
          </article>

          {collaborators.map((member) => (
            <article key={member._id} className="sync-panel">
              <h3>{member.name || member.email}</h3>
              <p>Accepted Collaborator</p>
            </article>
          ))}
        </section>
      )}

      {activeTab === "chat" && (
        <section className="sync-panel">
          <h2>Team Chat</h2>
          <p>Discuss tasks, share updates, and coordinate with your team.</p>

          <Chatbox projectId={projectId} />
        </section>
      )}
    </div>
  );
}
