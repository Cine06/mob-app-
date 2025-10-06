const express = require("express");
const fetch = require("node-fetch"); 
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(cors());

async function extractPagesFromBuffer(arrayBuffer) {
  const raw = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: raw });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((it) => it.str).join(" ");
    pages.push(pageText);
  }

  return { pages, pageCount: pdf.numPages };
}

app.post("/extract", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "url required" });
    }

    const r = await fetch(url, { timeout: 20000 });
    if (!r.ok) {
      return res.status(400).json({ error: "failed to fetch pdf" });
    }

    const arrayBuffer = await r.arrayBuffer();
    const { pages, pageCount } = await extractPagesFromBuffer(arrayBuffer);

    const needsOcr = pages
      .map((t, i) => ({ text: t.trim(), index: i }))
      .filter((p) => p.text.length < 10)
      .map((p) => p.index);

    res.json({ pages, pageCount, needsOcr });
  } catch (err) {
    console.error("extract error", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("PDF extractor listening on", PORT);
});
