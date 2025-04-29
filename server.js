const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000; // Default Next.js port

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Keep track of users and their socket IDs (simple in-memory store)
const userSocketMap = new Map(); // Map<userId, socketId>

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer(handler);

  // Attach Socket.IO to the HTTP server
  const io = new Server(httpServer, {
    // No specific path needed here, defaults to /socket.io
    // Add CORS configuration if needed for different origins
    // cors: { origin: "*", methods: ["GET", "POST"] }
  });

  // --- Socket.IO Connection Logic ---
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("registerUser", (userId) => {
      if (userId) {
        console.log(`Registering user ${userId} with socket ${socket.id}`);
        userSocketMap.set(userId, socket.id);
      }
    });

    socket.on("joinRoom", (roomId) => {
      console.log(`Socket ${socket.id} joining room ${roomId}`);
      socket.join(roomId);
    });

    socket.on("leaveRoom", (roomId) => {
      console.log(`Socket ${socket.id} leaving room ${roomId}`);
      socket.leave(roomId);
    });

    socket.on("sendMessage", (data) => {
      const { text, roomId, senderId } = data;
      console.log(
        `Message received in room ${roomId} from ${senderId}: ${text}`
      );
      // Emit only to others in the room
      socket.to(roomId).emit("receiveMessage", { text, roomId, senderId });
      // Optional: Persist message
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(
            `Unregistered user ${userId} associated with socket ${socket.id}`
          );
          break; // Assuming one user ID per socket ID
        }
      }
    });
  });
  // --- End Socket.IO Logic ---

  // Start the HTTP server
  httpServer
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log("Socket.IO server initialized and attached.");
    })
    .on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });
});
