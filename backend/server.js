const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const matchRoutes = require("./routes/matchRoutes");
const userRoutes = require('./routes/userRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Or your specific frontend origin
  },
});

app.use(cors());
app.use(express.json());
app.use("/api/matches", matchRoutes);
app.use('/api/users', userRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.io connection
io.on("connection", (socket) => {
  console.log("🟢 A user connected");

  socket.on("join-match", (matchId) => {
    // The room name should be consistent. Let's stick to a simple matchId.
    socket.join(matchId);
    console.log(`User ${socket.id} joined room: ${matchId}`);
  });

  // ✅ FIX: Listen for 'live-score-update' to match the frontend sender.
  socket.on("live-score-update", ({ matchId, payload }) => {
    if (matchId && payload) {
      console.log(`Relaying score update to room: ${matchId}`);
      // ✅ FIX: Broadcast only the 'payload' to the 'score-updated' event.
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
