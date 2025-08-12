import config from './config'
import { Logger } from "@polygonlabs/servercore";
import { Hono } from "hono";
import { cors } from "hono/cors";
import indexRoutes from './routes'

const app = new Hono()

async function serve(): Promise<void> {
    Logger.create({
        sentry: {
            dsn: process.env.SENTRY_DSN,
            level: "error",
        },
        console: {
            level: "debug",
        },
    });

    // Middlewares
    // app.use("*", logger()); // Logs all requests
    app.use("*", cors()); // Enables CORS for all routes

    // Register routes
    app.route("/api", indexRoutes);

    app.get("/health-check", (c) => {
        return c.json({ success: true, message: 'Health Check Success' }, 200)
    })
}

serve();

export default {
    port: process.env.PORT || 3000,
    fetch: app.fetch,
};
