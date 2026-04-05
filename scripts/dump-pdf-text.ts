#!/usr/bin/env tsx
// Quick diagnostic: dump raw extracted PDF text to stdout
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import pdfParse from "pdf-parse";

const pdfPath = process.argv[2];
if (!pdfPath) { console.error("Usage: npx tsx scripts/dump-pdf-text.ts <path>"); process.exit(1); }

const buf = fs.readFileSync(path.resolve(pdfPath));
const pdfMod: any = (pdfParse as any);

async function main() {
  let text = "";
  if (typeof pdfMod?.PDFParse === "function") {
    const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const parser = new pdfMod.PDFParse(uint8);
    const out = await parser.getText();
    text = typeof out === "string" ? out : (out as any)?.text ?? String(out ?? "");
    await parser.destroy?.();
  } else {
    const fn: any = pdfMod?.default ?? pdfMod;
    const data = await fn(buf);
    text = data?.text ?? "";
  }
  // Replace \r\n, show every line numbered
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  lines.forEach((l, i) => console.log(`${String(i+1).padStart(4, "0")}: ${l}`));
}
main().catch(e => { console.error(e); process.exit(1); });
