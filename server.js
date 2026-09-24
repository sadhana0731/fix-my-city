const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "https://fixmycity.in",
    "https://www.fixmycity.in",
    "http://localhost:3000"
  ]
}));

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id BIGSERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'Normal',
      votes INTEGER NOT NULL DEFAULT 0,
      x REAL NOT NULL,
      y REAL NOT NULL,
      photo TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        category AS cat,
        title,
        description AS desc,
        urgency AS urg,
        votes,
        x,
        y,
        photo,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at)::int AS days
      FROM reports
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load reports" });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const { cat, title, desc, urg, photo, x, y } = req.body;

    if (!cat || !title || !desc) {
      return res.status(400).json({
        error: "Category, title and description are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO reports
        (category, title, description, urgency, photo, x, y)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        category AS cat,
        title,
        description AS desc,
        urgency AS urg,
        votes,
        x,
        y,
        photo,
        0 AS days
      `,
      [
        cat,
        title,
        desc,
        urg || "Normal",
        photo || null,
        Number(x) || 50,
        Number(y) || 50
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create report" });
  }
});

app.post("/api/reports/:id/upvote", async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE reports
      SET votes = votes + 1
      WHERE id = $1
      RETURNING
        id,
        category AS cat,
        title,
        description AS desc,
        urgency AS urg,
        votes,
        x,
        y,
        photo,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - created_at)::int AS days
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not upvote report" });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Fix My City API running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
