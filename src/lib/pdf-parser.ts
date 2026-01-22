import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

// Configure worker as a bundled asset (no CDN, no dynamic import)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = (textContent.items as any[])
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const str = typeof item.str === "string" ? item.str : "";
        const suffix = item.hasEOL ? "\n" : " ";
        return str ? str + suffix : "";
      })
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    fullText += pageText + "\n\n";
  }

  return fullText.trim();
}

