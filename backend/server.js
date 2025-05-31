const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const matchRoutes = require("./routes/matchRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://red-shrew-841581.hostingersite.com", // ✅ Your actual frontend domain
    methods: ["GET", "POST"], // Or your specific frontend origin
  },
});

app.use(cors());
app.use(express.json());
app.use("/api/matches", matchRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.io connection
io.on("connection", (socket) => {
  console.log("🟢 A user connected");

  socket.on("join-match", (matchId) => {
    socket.join(`match:${matchId}`);  // ✅ Correct template literal usage
    console.log(`User joined match: ${matchId}`);
  });

  socket.on("update-score", ({ matchId, data }) => {
    socket.to(`match:${matchId}`).emit("score-updated", data);  // ✅ Correct
  });

  socket.on("disconnect", () => {
    console.log("🔴 A user disconnected");
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
