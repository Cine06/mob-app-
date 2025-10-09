// server.js (MULTI-PAGE FIXED)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

app.post("/extract", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing PDF URL" });

    console.log(`📘 Extracting text from PDF: ${url}`);

    // Fetch PDF file
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    // Load PDF with pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pagePromises = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      pagePromises.push(pdf.getPage(i).then(page => page.getTextContent()));
    }

    const pageContents = await Promise.all(pagePromises);
    const pages = pageContents.map(content => content.items.map(item => item.str).join(" ").trim() || "[No extractable text on this page]");

    console.log(`✅ Extracted ${pages.length} pages`);
    res.json({ pages });
  } catch (err) {
    console.error("❌ PDF extraction failed:", err);
    res.status(500).json({ error: "PDF extraction failed" });
  }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

// Increase timeout to handle large PDFs that take time to download and process
server.setTimeout(300000); // 5 minutes
