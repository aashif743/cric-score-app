const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

// Import your route files
const matchRoutes = require("./routes/matchRoutes");
const userRoutes = require("./routes/userRoutes");

dotenv.config();

const app = express();

// ✅ Create HTTP server from the Express app
const server = http.createServer(app);

// ✅ Initialize socket.io using the correct server variable
const io = new Server(server, {
  cors: {
    origin: "https://red-shrew-841581.hostingersite.com", // Your frontend domain
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: "https://red-shrew-841581.hostingersite.com",
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use("/api/matches", matchRoutes);
app.use("/api/users", userRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.io Events
io.on("connection", (socket) => {
  console.log("🟢 A user connected");

  socket.on("join-match", (matchId) => {
    socket.join(matchId);
    console.log(`User ${socket.id} joined room: ${matchId}`);
  });

  socket.on("live-score-update", ({ matchId, payload }) => {
    if (matchId && payload) {
      console.log(`Relaying score update to room: ${matchId}`);
      socket.to(matchId).emit("score-updated", payload);
    }
  });

  socket.on("leave-match", (matchId) => {
    socket.leave(matchId);
    console.log(`User ${socket.id} left room: ${matchId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected");
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
