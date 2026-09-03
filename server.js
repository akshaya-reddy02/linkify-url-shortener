const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

// Serve frontend
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// Create short URL
app.post("/shorten", async (req, res) => {
    try {
        const { originalUrl } = req.body;

        if (!originalUrl) {
            return res.status(400).json({
                error: "URL is required"
            });
        }

        const shortCode = crypto
            .randomBytes(4)
            .toString("hex");

        const result = await pool.query(
            "INSERT INTO urls (original_url, short_code) VALUES ($1, $2) RETURNING *",
            [originalUrl, shortCode]
        );

        res.json({
            message: "URL shortened successfully",
            shortUrl: `http://localhost:3000/${shortCode}`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// Get click statistics
app.get("/stats/:shortCode", async (req, res) => {
    try {
        const { shortCode } = req.params;

        const result = await pool.query(
            "SELECT clicks FROM urls WHERE short_code = $1",
            [shortCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }

        res.json({
            clicks: result.rows[0].clicks
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// Redirect short URL
app.get("/:shortCode", async (req, res) => {
    try {
        const { shortCode } = req.params;

        const result = await pool.query(
            "SELECT * FROM urls WHERE short_code = $1",
            [shortCode]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Short URL not found");
        }

        const url = result.rows[0];

        await pool.query(
            "UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1",
            [shortCode]
        );

        res.redirect(url.original_url);

    } catch (error) {
        console.error(error);

        res.status(500).send("Server error");
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running at http://localhost:${process.env.PORT}`);
});