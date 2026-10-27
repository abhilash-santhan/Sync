
import { useCallback, useEffect, useRef, useState } from "react";
import "./Chatbox.css";

const API = "http://localhost:3001";

export default function Chatbox({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const token = sessionStorage.getItem("syncToken");
  const currentUser = JSON.parse(
    sessionStorage.getItem("syncUser") || "null"
  );
  const currentUserId = String(
    currentUser?.id || currentUser?._id || ""
  );

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API}${url}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Chat request failed.");
    }

    return result;
  }, [token]);

  const loadMessages = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const result = await request(
        `/api/chat/${encodeURIComponent(projectId)}`
      );
      setMessages(result.messages || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, request]);

  useEffect(() => {
    loadMessages(true);

    const interval = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();

    const messageText = text.trim();
    if (!messageText || sending) return;

    setSending(true);
    setError("");

    try {
      const result = await request(
        `/api/chat/${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          body: JSON.stringify({ text: messageText }),
        }
      );

      setMessages((previous) => [
        ...previous,
        result.message,
      ]);
      setText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sync-chatbox">
      <header className="sync-chat-header">
        <div>
          <h2>Project Team Chat</h2>
          <p>Collaborate and keep your team updated.</p>
        </div>

        <button
          type="button"
          onClick={() => loadMessages(true)}
          disabled={loading}
          className="sync-chat-refresh"
        >
          Refresh
        </button>
      </header>

      {error && (
        <p className="sync-chat-error" role="alert">
          {error}
        </p>
      )}

      <div className="sync-chat-messages" aria-live="polite">
        {loading ? (
          <p className="sync-chat-empty">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="sync-chat-empty">
            No messages yet. Say hello to your team!
          </p>
        ) : (
          messages.map((message) => {
            const senderId = String(
              message.sender?._id || message.sender?.id || ""
            );
            const isMine =
              currentUserId !== "" && senderId === currentUserId;

            return (
              <div
                key={message._id}
                className={`sync-chat-row ${
                  isMine ? "sync-chat-row-mine" : "sync-chat-row-other"
                }`}
              >
                <article
                  className={`sync-chat-bubble ${
                    isMine
                      ? "sync-chat-bubble-mine"
                      : "sync-chat-bubble-other"
                  }`}
                >
                  {!isMine && (
                    <strong className="sync-chat-sender">
                      {message.sender?.name || "Team member"}
                    </strong>
                  )}

                  <p>{message.text}</p>

                  <time>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </article>
              </div>
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      <form className="sync-chat-form" onSubmit={sendMessage}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          rows={2}
          required
        />

        <div className="sync-chat-form-footer">
          <span>{text.length}/2000</span>

          <button type="submit" disabled={!text.trim() || sending}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
