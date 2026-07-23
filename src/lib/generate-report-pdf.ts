import PDFDocument from "pdfkit";
import type { SmileAnalysis } from "@/app/api/analyze/route";

interface LeadForPdf {
  name: string;
  smileScore: number | null;
  analysisJson: string | null;
  doctorNotes: string | null;
  createdAt: Date;
}

const GOLD_DARK = "#7d5f26";
const GOLD = "#a07830";
const GOLD_LIGHT = "#d4a84b";
const INK = "#1a1714";
const MUTED = "#6b6459";
const CREAM = "#faf6ec";
const CREAM_LINE = "#eadfc0";

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545.28;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const PAGE_BOTTOM = 780;

const SEVERITY_STYLE: Record<string, { fg: string; bg: string }> = {
  mild: { fg: "#b45309", bg: "#fef3c7" },
  moderate: { fg: "#c2410c", bg: "#ffedd5" },
  severe: { fg: "#b91c1c", bg: "#fee2e2" },
};

function scoreStyle(score: number) {
  if (score >= 85) return { fg: "#15803d", ring1: "#4ade80", ring2: "#16a34a" };
  if (score >= 70) return { fg: GOLD_DARK, ring1: GOLD_LIGHT, ring2: GOLD };
  if (score >= 50) return { fg: "#b45309", ring1: "#fbbf24", ring2: "#d97706" };
  return { fg: "#b91c1c", ring1: "#f87171", ring2: "#dc2626" };
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

function drawSmiley(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number) {
  doc.save();
  doc.circle(cx, cy, r).fillOpacity(0.22).fill("#ffffff");
  doc.fillOpacity(1);
  doc.circle(cx - r * 0.32, cy - r * 0.12, r * 0.11).fill("#ffffff");
  doc.circle(cx + r * 0.32, cy - r * 0.12, r * 0.11).fill("#ffffff");
  doc.lineWidth(r * 0.16).lineCap("round")
    .moveTo(cx - r * 0.4, cy + r * 0.15)
    .quadraticCurveTo(cx, cy + r * 0.65, cx + r * 0.4, cy + r * 0.15)
    .stroke("#ffffff");
  doc.restore();
}

function drawHeader(doc: PDFKit.PDFDocument, lead: LeadForPdf) {
  const headerH = 118;
  const grad = doc.linearGradient(0, 0, PAGE_RIGHT + 50, headerH);
  grad.stop(0, GOLD_DARK).stop(0.5, GOLD).stop(1, GOLD_LIGHT);
  doc.rect(0, 0, 595.28, headerH).fill(grad);

  drawSmiley(doc, PAGE_LEFT + 24, 40, 20);

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22)
    .text("Smile Passport", PAGE_LEFT + 56, 28, { lineBreak: false });
  doc.fillColor("#fbf0d9").font("Helvetica").fontSize(9.5)
    .text("AI-POWERED SMILE SCREENING", PAGE_LEFT + 56, 52, { characterSpacing: 1.2, lineBreak: false });

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15)
    .text(lead.name, PAGE_LEFT, 78, { width: PAGE_WIDTH * 0.6, lineBreak: false });
  doc.fillColor("#fbf0d9").font("Helvetica").fontSize(9.5)
    .text(
      `Report generated on ${lead.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
      PAGE_LEFT, 98, { width: PAGE_WIDTH * 0.7, lineBreak: false }
    );

  doc.y = headerH + 30;
}

function drawSectionLabel(doc: PDFKit.PDFDocument, text: string, color: string) {
  ensureSpace(doc, 24);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(11.5)
    .text(text.toUpperCase(), PAGE_LEFT, doc.y, { characterSpacing: 0.6 });
  doc.moveDown(0.5);
}

function drawScoreSection(doc: PDFKit.PDFDocument, score: number, overallImpression?: string) {
  ensureSpace(doc, 100);
  const top = doc.y;
  const boxH = 92;
  const style = scoreStyle(score);

  doc.roundedRect(PAGE_LEFT, top, PAGE_WIDTH, boxH, 14).fill(CREAM);

  const cx = PAGE_LEFT + 56;
  const cy = top + boxH / 2;
  const r = 34;
  const ringGrad = doc.linearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.stop(0, style.ring1).stop(1, style.ring2);
  doc.circle(cx, cy, r).fill(ringGrad);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text(String(score), cx - r, cy - 11, { width: r * 2, align: "center", lineBreak: false });

  const textX = PAGE_LEFT + 110;
  const textW = PAGE_WIDTH - 130;
  doc.fillColor(style.fg).font("Helvetica-Bold").fontSize(10)
    .text("YOUR SMILE SCORE", textX, top + 16, { characterSpacing: 0.6, width: textW });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13)
    .text(`${score} out of 100`, textX, top + 30, { width: textW });
  if (overallImpression) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5)
      .text(overallImpression, textX, top + 48, { width: textW, lineGap: 1.5 });
  }

  doc.y = top + boxH + 22;
}

function drawPositives(doc: PDFKit.PDFDocument, positives: string[]) {
  drawSectionLabel(doc, "What's looking good", "#15803d");
  positives.forEach((p) => {
    doc.font("Helvetica").fontSize(10);
    const textH = doc.heightOfString(p, { width: PAGE_WIDTH - 50 });
    const rowH = Math.max(textH, 12) + 14;
    ensureSpace(doc, rowH + 6);
    const top = doc.y;
    doc.roundedRect(PAGE_LEFT, top, PAGE_WIDTH, rowH, 8).fill("#dcfce7");
    const checkCy = top + rowH / 2;
    doc.lineWidth(1.6).lineCap("round").lineJoin("round")
      .moveTo(PAGE_LEFT + 12, checkCy)
      .lineTo(PAGE_LEFT + 15.5, checkCy + 3.5)
      .lineTo(PAGE_LEFT + 21, checkCy - 4.5)
      .stroke("#15803d");
    doc.fillColor("#166534").font("Helvetica").fontSize(10)
      .text(p, PAGE_LEFT + 30, top + 7, { width: PAGE_WIDTH - 50 });
    doc.y = top + rowH + 6;
  });
  doc.moveDown(0.6);
}

function drawIssues(doc: PDFKit.PDFDocument, issues: SmileAnalysis["issues"]) {
  drawSectionLabel(doc, "Areas to address", GOLD_DARK);
  issues.forEach((issue) => {
    const sev = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.mild;
    const descW = PAGE_WIDTH - 32;
    doc.font("Helvetica").fontSize(9.5);
    const descH = issue.description ? doc.heightOfString(issue.description, { width: descW }) : 0;
    const treatText = issue.suggestedTreatments?.length ? `Suggested: ${issue.suggestedTreatments.join(", ")}` : "";
    doc.font("Helvetica-Oblique").fontSize(9);
    const treatH = treatText ? doc.heightOfString(treatText, { width: descW }) : 0;
    const cardH = 30 + descH + (treatH ? treatH + 8 : 0) + 14;

    ensureSpace(doc, cardH + 10);
    const top = doc.y;

    doc.roundedRect(PAGE_LEFT, top, PAGE_WIDTH, cardH, 10).fill(CREAM);
    doc.rect(PAGE_LEFT, top, 4, cardH).fill(sev.fg);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11)
      .text(issue.issue, PAGE_LEFT + 16, top + 12, { width: descW - 90, lineBreak: false });

    const chipText = issue.severity.toUpperCase();
    doc.font("Helvetica-Bold").fontSize(8);
    const chipW = doc.widthOfString(chipText) + 16;
    const chipX = PAGE_RIGHT - chipW - 8;
    doc.roundedRect(chipX, top + 10, chipW, 16, 8).fill(sev.bg);
    doc.fillColor(sev.fg).font("Helvetica-Bold").fontSize(8)
      .text(chipText, chipX, top + 14, { width: chipW, align: "center", lineBreak: false });

    let cursorY = top + 30;
    if (issue.description) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(9.5)
        .text(issue.description, PAGE_LEFT + 16, cursorY, { width: descW, lineGap: 1.5 });
      cursorY += descH + 6;
    }
    if (treatText) {
      doc.fillColor(GOLD).font("Helvetica-Oblique").fontSize(9)
        .text(treatText, PAGE_LEFT + 16, cursorY, { width: descW });
    }

    doc.y = top + cardH + 10;
  });
  doc.moveDown(0.4);
}

function drawDoctorNotes(doc: PDFKit.PDFDocument, notes: string) {
  drawSectionLabel(doc, "Dentist's personal review", GOLD_DARK);
  const width = PAGE_WIDTH - 32;
  doc.font("Helvetica-Oblique").fontSize(10.5);
  const textH = doc.heightOfString(`"${notes}"`, { width });
  const boxH = textH + 28;
  ensureSpace(doc, boxH + 10);
  const top = doc.y;
  doc.roundedRect(PAGE_LEFT, top, PAGE_WIDTH, boxH, 12).fillAndStroke(CREAM, CREAM_LINE);
  doc.fillColor(INK).font("Helvetica-Oblique").fontSize(10.5)
    .text(`"${notes}"`, PAGE_LEFT + 16, top + 14, { width });
  doc.y = top + boxH + 20;
}

function drawFooter(doc: PDFKit.PDFDocument) {
  ensureSpace(doc, 60);
  const barY = doc.y;
  const grad = doc.linearGradient(PAGE_LEFT, barY, PAGE_RIGHT, barY);
  grad.stop(0, "#22c55e").stop(0.35, GOLD_LIGHT).stop(0.65, "#f59e0b").stop(1, "#dc2626");
  doc.rect(PAGE_LEFT, barY, PAGE_WIDTH, 4).fill(grad);
  doc.fillColor("#8c8479").font("Helvetica").fontSize(8.5)
    .text(
      "This report is a preliminary screening based on submitted photos and professional dental review. It is not a substitute for an in-person dental examination.",
      PAGE_LEFT, barY + 14, { width: PAGE_WIDTH, lineGap: 2 }
    );
}

export async function generateReportPdf(lead: LeadForPdf): Promise<Buffer> {
  const analysis: SmileAnalysis | null = lead.analysisJson ? JSON.parse(lead.analysisJson) : null;

  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawHeader(doc, lead);

  if (lead.smileScore != null) {
    drawScoreSection(doc, lead.smileScore, analysis?.overallImpression);
  }

  if (analysis?.positives?.length) {
    drawPositives(doc, analysis.positives);
  }

  if (analysis?.issues?.length) {
    drawIssues(doc, analysis.issues);
  }

  drawDoctorNotes(doc, lead.doctorNotes?.trim() || "Our dentist has reviewed your smile scan and confirms the findings above.");

  drawFooter(doc);

  doc.end();
  return done;
}
