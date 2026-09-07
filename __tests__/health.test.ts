import request from "supertest";
import { app } from "../app";

describe("Health Check Endpoints", () => {
  it("GET / should return 200 with healthy status", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /health should return 200 with healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("User Registration Validation", () => {
  it("POST /api/v1/registration should reject missing name", async () => {
    const res = await request(app)
      .post("/api/v1/registration")
      .send({ email: "test@test.com", password: "password123" });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/v1/registration should reject invalid email", async () => {
    const res = await request(app)
      .post("/api/v1/registration")
      .send({ name: "Test", email: "not-an-email", password: "password123" });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /api/v1/registration should reject short password", async () => {
    const res = await request(app)
      .post("/api/v1/registration")
      .send({ name: "Test", email: "test@test.com", password: "123" });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("Protected Routes Guard", () => {
  it("GET /api/v1/me should return 401 when not authenticated", async () => {
    const res = await request(app).get("/api/v1/me");
    // 401 or 400 depending on refresh token middleware
    expect([400, 401]).toContain(res.statusCode);
  });
});
