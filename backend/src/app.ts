import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { menuRouter } from "./routes/menu";
import { pickupSlotsRouter } from "./routes/pickupSlots";
import { checkoutRouter } from "./routes/checkout";
import { webhookRouter } from "./routes/webhook";
import { ordersRouter } from "./routes/orders";
import { adminRouter } from "./routes/admin";
import { adminMenuRouter } from "./routes/adminMenu";
import { authRouter } from "./routes/auth";

export const app = express();

// Raw body needed for webhook signature verification
app.use("/webhook", express.raw({ type: "application/json" }));

// JSON body parsing for all other routes
app.use(express.json());

app.use(requestLogger);

// API routes
app.use("/menu", menuRouter);
app.use("/pickup-slots", pickupSlotsRouter);
app.use("/checkout", checkoutRouter);
app.use("/webhook", webhookRouter);
app.use("/orders", ordersRouter);
app.use("/admin", adminRouter);
app.use("/admin", adminMenuRouter);
app.use("/auth", authRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: "Route not found" });
});

// Global error handler (must be last)
app.use(errorHandler);
