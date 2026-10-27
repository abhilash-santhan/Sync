
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// All follow routes require authentication.
router.use(authenticateToken);

// GET /api/follow/:userId/status
router.get("/:userId/status", async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const target = await User.findById(targetUserId).select("name role");

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findById(currentUserId).select("following");

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId
    );

    const [followersCount, followingCount] = await Promise.all([
      User.countDocuments({ following: target._id }),
      User.countDocuments({ following: currentUser._id }),
    ]);

    return res.json({
      isFollowing,
      followersCount,
      followingCount,
      user: {
        id: target._id,
        name: target.name,
        role: target.role,
      },
    });
  } catch (error) {
    console.error("Follow status error:", error.message);
    return res.status(500).json({ message: "Unable to load follow status" });
  }
});

// POST /api/follow/:userId
router.post("/:userId", async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const target = await User.findById(targetUserId).select("_id");

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: target._id } },
      { new: true }
    ).select("following");

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const followersCount = await User.countDocuments({
      following: target._id,
    });

    return res.json({
      message: "User followed successfully",
      isFollowing: true,
      followersCount,
    });
  } catch (error) {
    console.error("Follow error:", error.message);
    return res.status(500).json({ message: "Unable to follow user" });
  }
});

// DELETE /api/follow/:userId
router.delete("/:userId", async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const target = await User.findById(targetUserId).select("_id");

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUser = await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: target._id } },
      { new: true }
    ).select("following");

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const followersCount = await User.countDocuments({
      following: target._id,
    });

    return res.json({
      message: "User unfollowed successfully",
      isFollowing: false,
      followersCount,
    });
  } catch (error) {
    console.error("Unfollow error:", error.message);
    return res.status(500).json({ message: "Unable to unfollow user" });
  }
});

// GET /api/follow/following/list
router.get("/following/list", async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId)
      .select("following")
      .populate("following", "name email role avatar bio");

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    return res.json({
      following: currentUser.following,
      followingCount: currentUser.following.length,
    });
  } catch (error) {
    console.error("Following list error:", error.message);
    return res.status(500).json({ message: "Unable to load following list" });
  }
});

module.exports = router;
