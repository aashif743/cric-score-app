// Load .env BEFORE any of our own modules are required — otherwise
// constants those modules read from process.env at module-load time
// (e.g. REVIEW_TEST_PHONE in userController.js) will be undefined.
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const compression = require("compression");
const { Server } = require("socket.io");

// Keep the process alive on stray async errors. Without these, a single
// unhandled promise rejection (e.g. a transient DB blip on a hot path) would
// terminate the whole server and drop every connected user.
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

// Import your route files (now safe — env vars are populated).
const matchRoutes = require("./routes/matchRoutes");
const userRoutes = require("./routes/userRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");
const tournamentRoutes = require("./routes/tournamentRoutes");
const publicRoutes = require("./routes/publicRoutes");
const liveRoutes = require("./routes/liveRoutes");
const auctionRoutes = require("./routes/auctionRoutes");
const appRoutes = require("./routes/appRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Render (and most hosts) put a reverse proxy in front. Trust the first proxy
// hop so req.ip reflects the real client IP — required for per-IP rate limiting
// to bucket users individually instead of lumping everyone under the proxy IP.
app.set("trust proxy", 1);

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

// Make the Socket.io server available to controllers (auction broadcasts).
app.set("io", io);

// Security headers + gzip (big JSON payloads compress well for mobile clients).
// helmet's default CSP is disabled — this is a JSON API, not an HTML app, and a
// strict CSP here can interfere with cross-origin asset/image use.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(compression());

// CORS configuration for Express API routes
app.use(cors(corsOptions));

app.use(express.json({ limit: "2mb" }));

// Health check endpoint (for keep-alive pings)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/matches", matchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/suggestions", suggestionRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/live", liveRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/app", appRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin", adminRoutes);

// MongoDB Connection — bounded pool + fast failover so a slow/broken DB rejects
// quickly instead of hanging requests and exhausting sockets under load.
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

mongoose.connection.on("error", (err) => console.error("⚠️ MongoDB error:", err.message));
mongoose.connection.on("disconnected", () => console.warn("⚠️ MongoDB disconnected"));
mongoose.connection.on("reconnected", () => console.log("✅ MongoDB reconnected"));

// In-memory cache of "is this match's tournament public?" so the fan-out
// hot path doesn't hit MongoDB on every ball. Entries expire after 5 minutes
// so visibility toggles eventually propagate without a server restart.
const Match = require("./models/Match");
const Tournament = require("./models/Tournament");
const publicMatchCache = new Map(); // matchId -> { isPublic: bool, exp: ms }
const PUBLIC_CACHE_TTL = 5 * 60 * 1000;

async function isMatchPublic(matchId) {
  const now = Date.now();
  const cached = publicMatchCache.get(matchId);
  if (cached && cached.exp > now) return cached.isPublic;

  let isPublic = false;
  try {
    const match = await Match.findById(matchId).select("tournament").lean();
    if (match?.tournament) {
      const t = await Tournament.findById(match.tournament).select("visibility").lean();
      // Anything not explicitly "private" counts as public (schema default is
      // "public"; legacy tournaments have no visibility field stored).
      isPublic = !!t && t.visibility !== "private";
    }
  } catch (err) {
    console.error("isMatchPublic lookup failed:", err.message);
  }
  publicMatchCache.set(matchId, { isPublic, exp: now + PUBLIC_CACHE_TTL });
  return isPublic;
}

// Socket.io Events
io.on("connection", (socket) => {
  socket.on("join-match", (matchId) => {
    socket.join(matchId);
  });

  // Dashboard live strip subscribes to this global room. Any score update on
  // any public match results in a 'public-live-update' broadcast carrying the
  // matchId so the strip can refetch / patch just that card.
  socket.on("join-public-live", () => {
    socket.join("public-live");
  });
  socket.on("leave-public-live", () => {
    socket.leave("public-live");
  });

  socket.on("live-score-update", async ({ matchId, payload }) => {
    if (!matchId || !payload) return;
    // 1) Per-match room — viewers of the specific match (existing behavior).
    socket.to(matchId).emit("score-updated", payload);
    // 2) Global public-live room — only if the match belongs to a public
    //    tournament. Sent to everyone in the room *including* the scorer's
    //    own connection, so any dashboard the scorer also has open updates.
    try {
      if (await isMatchPublic(matchId)) {
        io.to("public-live").emit("public-live-update", { matchId, ts: Date.now() });
      }
    } catch (err) {
      // Don't let the fan-out break score relaying.
      console.error("public-live fan-out failed:", err.message);
    }
  });

  socket.on("leave-match", (matchId) => {
    socket.leave(matchId);
  });

  // Auction rooms — control panel, big screen and owner devices join to receive
  // live 'auction:update' broadcasts (the actual actions go through the REST API,
  // which validates and then emits to this room).
  socket.on("join-auction", (auctionId) => {
    if (auctionId) socket.join(`auction:${auctionId}`);
  });
  socket.on("leave-auction", (auctionId) => {
    if (auctionId) socket.leave(`auction:${auctionId}`);
  });

  socket.on("disconnect", () => {});
});

// Global error handler — anything a route throws lands here as JSON instead of a
// default HTML 500, and is logged consistently (never crashes the process).
app.use((err, req, res, next) => {
  console.error("API error:", err.message);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ success: false, error: "Server error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
