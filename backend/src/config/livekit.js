// Load environment variables.
require("dotenv").config();

// Import the LiveKit server SDK.
const {
  AccessToken,
  RoomServiceClient,
} = require("livekit-server-sdk");

// Retrieve LiveKit configuration.
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// Validate the required environment variables.
if (
  !LIVEKIT_URL ||
  !LIVEKIT_API_KEY ||
  !LIVEKIT_API_SECRET
) {
  throw new Error("Missing LiveKit environment variables.");
}

// Convert the WebSocket URL to an HTTPS URL.
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace(
  /^wss:/,
  "https:"
);

// Initialize the LiveKit room service.
const roomService = new RoomServiceClient(
  LIVEKIT_HTTP_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
);

// Generate a secure classroom access token.
// The controller must verify user authorization before calling this function.
async function generateLiveKitToken({
  roomName,
  userId,
  fullName,
}) {
  if (!roomName || !userId || !fullName) {
    throw new Error("Missing classroom participant information.");
  }

  // Create a participant access token.
  const token = new AccessToken(
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    {
      identity: String(userId),
      name: fullName,
      ttl: "5m",
    }
  );

  // Grant classroom participation permissions.
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  // Generate and return the signed JWT.
  return await token.toJwt();
}

// Export the LiveKit configuration and services.
module.exports = {
  LIVEKIT_URL,
  roomService,
  generateLiveKitToken,
};