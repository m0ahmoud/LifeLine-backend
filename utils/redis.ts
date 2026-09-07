import Redis from "ioredis";

// Upstash Redis Configuration
const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  return {
    url: redisUrl,
    config: {
      tls: {
        rejectUnauthorized: false, // ضروري لـ Upstash
      },
      family: 0, // Use IPv4 and IPv6
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: 10000,
      retryStrategy(times: number) {
        if (times > 10) {
          console.error("❌ Max Redis retry attempts reached");
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        console.log(`⏳ Retrying Redis connection in ${delay}ms...`);
        return delay;
      },
    },
  };
};

// Create Redis instance
const { url, config } = getRedisConfig();
export const redis = new Redis(url, config);

// Event listeners
redis.on("connect", () => {
  console.log("✅ Connected to Upstash Redis");
});

redis.on("ready", () => {
  console.log("✅ Redis client is ready");
});

redis.on("error", (error) => {
  // Don't crash on ECONNRESET
  if (error.message.includes("ECONNRESET")) {
    console.warn("⚠️ Redis connection reset (non-fatal)");
  } else {
    console.error("❌ Redis error:", error.message);
  }
});

redis.on("close", () => {
  console.log("⚠️ Redis connection closed");
});

redis.on("reconnecting", (delay: number) => {
  console.log(`🔄 Reconnecting to Redis in ${delay}ms...`);
});

// Graceful shutdown
const shutdown = async () => {
  try {
    console.log("Shutting down Redis connection...");
    await redis.quit();
    console.log("✅ Redis connection closed gracefully");
    process.exit(0);
  } catch (error) {
    console.error("Error during Redis shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
