import { useEffect, useRef } from "react";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Joins the auction's live room and invokes onUpdate(payload) on every
// 'auction:update' the server broadcasts (open lot, bid, sold, unsold, ...).
export default function useAuctionSocket(auctionId, onUpdate) {
  const socketRef = useRef(null);
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    if (!auctionId) return undefined;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join-auction", auctionId));
    socket.on("auction:update", (payload) => cb.current && cb.current(payload));
    return () => {
      try { socket.emit("leave-auction", auctionId); } catch (_) {}
      socket.disconnect();
    };
  }, [auctionId]);

  return socketRef;
}
