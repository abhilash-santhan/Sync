require("dotenv").config();
const verificationRoutes = require("./routes/verification");
const express = require("express");
const cors = require("cors");
const { connectDb } = require("./config/database");
const adminRoutes = require("./routes/admin");
const projectRoutes = require("./routes/projects");
const opportunityRoutes = require("./routes/opportunities");
const applicationRoutes = require("./routes/applications");
const taskRoutes = require("./routes/tasks");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const path = require("path");
const authenticateToken = require("./middleware/auth");
const User = require("./models/user");
const followRoutes = require("./routes/follow");
const app = express();

app.use(
  cors({
    origin: "http://localhost:1234",
  })
);

app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin", adminRoutes);app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/follow", followRoutes);
// Public health check
app.get("/", (req, res) => {
  res.json({ message: "SYNC backend is running" });
});

// Protected user profile route
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    return res.status(500).json({ message: "Unable to fetch profile" });
  }
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDb();
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
