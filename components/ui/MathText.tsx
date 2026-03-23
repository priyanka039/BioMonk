import React from "react";

interface MathTextProps {
  text: string;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GREEK: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  lambda: "λ",
  omega: "Ω",
  theta: "θ",
  phi: "φ",
  mu: "μ",
  nu: "ν",
  pi: "π",
  sigma: "σ",
};

export default function MathText({ text }: MathTextProps) {
  const raw = text ?? "";

  // Text-to-display transformations (PDFs do not contain LaTeX markup).
  let s = raw;
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, " ");

  // Operators/symbols.
  s = s.replace(/->/g, "→").replace(/\+\-/g, "±");
  s = s.replace(/\bdegree\b/gi, "°").replace(/\bdeg\b/gi, "°");

  for (const [name, char] of Object.entries(GREEK)) {
    s = s.replace(new RegExp(String.raw`\b${name}\b`, "gi"), char);
  }

  // Escape all user content first; we'll re-introduce only safe <sup>/<sub>/<span> tags later.
  s = escapeHtml(s);

  // Superscripts like "10^-10" and "10^{-10}".
  // Covers variants with optional spaces; keeps exponent as-is (including minus sign).
  s = s
    .replace(/(\d+(?:\.\d+)?)\s*\^\s*\{\s*(-?\d+)\s*\}/g, `$1<sup>$2</sup>`)
    .replace(/(\d+(?:\.\d+)?)\s*\^\s*(-?\d+)/g, `$1<sup>$2</sup>`);

  // Sanitize: allow only sup/sub/span tags (everything else gets stripped).
  s = s.replace(/<(?!\/?(?:sup|sub|span)\b)[^>]*>/g, "");

  return <span dangerouslySetInnerHTML={{ __html: s }} />;
}

