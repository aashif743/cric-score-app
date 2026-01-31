const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");


// Import your route files
const matchRoutes = require("./routes/matchRoutes");
const userRoutes = require("./routes/userRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");

dotenv.config();

const app = express();

// ✅ Create HTTP server from the Express app
const server = http.createServer(app);

const allowedOrigins = [
  "https://cric-zone.com",           // Production frontend
  "https://cric-score-app.onrender.com", // Render backend URL (for same-origin requests)
  "http://localhost:3000",           // Local React dev server
  "http://localhost:5173",           // Local Vite dev server
  "http://localhost:5002",           // Local mobile dev server
];

// Function to handle CORS for mobile apps (they don't send origin header)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for mobile app compatibility
    }
  },
  credentials: true,
};

// CORS configuration for Socket.IO (supports mobile apps)
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// CORS configuration for Express API routes
app.use(cors(corsOptions));

app.use(express.json());

// API Routes
app.use("/api/matches", matchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/suggestions", suggestionRoutes);
app.use("/api/tournaments", tournamentRoutes);

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
