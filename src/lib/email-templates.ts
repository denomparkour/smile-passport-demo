interface LeadForEmail {
  id: string;
  name: string;
  email: string;
  phone: string;
  smileScore: number | null;
  createdAt: Date;
  analysisJson?: string | null;
  doctorNotes?: string | null;
}

interface AnalysisIssue {
  issue: string;
  description?: string;
  severity: "mild" | "moderate" | "severe";
  suggestedTreatments?: string[];
}

interface Analysis {
  overallImpression?: string;
  positives?: string[];
  issues?: AnalysisIssue[];
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SEVERITY_STYLE: Record<string, { fg: string; bg: string }> = {
  mild: { fg: "#b45309", bg: "#fef3c7" },
  moderate: { fg: "#c2410c", bg: "#ffedd5" },
  severe: { fg: "#b91c1c", bg: "#fee2e2" },
};

function scoreStyle(score: number) {
  if (score >= 85) return { fg: "#15803d", bg: "#dcfce7", ring1: "#22c55e", ring2: "#16a34a" };
  if (score >= 70) return { fg: "#946621", bg: "#faf1dd", ring1: "#d4a84b", ring2: "#a07830" };
  if (score >= 50) return { fg: "#b45309", bg: "#fef3c7", ring1: "#f59e0b", ring2: "#d97706" };
  return { fg: "#b91c1c", bg: "#fee2e2", ring1: "#f87171", ring2: "#dc2626" };
}

const wrapper = (title: string, subtitle: string, body: string) => `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f3ede0;font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3ede0;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(160,120,48,0.15);">
            <tr>
              <td style="background:linear-gradient(120deg,#7d5f26 0%,#a07830 45%,#d4a84b 100%);padding:36px 32px;position:relative;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:44px;height:44px;background:rgba(255,255,255,0.22);border-radius:14px;text-align:center;vertical-align:middle;font-size:22px;">😁</td>
                          <td style="padding-left:14px;">
                            <p style="margin:0;color:#ffffff;font-size:21px;font-weight:900;letter-spacing:-0.02em;">Smile Passport</p>
                            <p style="margin:2px 0 0;color:#fbf0d9;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">AI-Powered Smile Screening</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <p style="margin:22px 0 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.01em;">${title}</p>
                <p style="margin:6px 0 0;color:#fbf0d9;font-size:13.5px;">${subtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="height:6px;background:linear-gradient(90deg,#22c55e,#d4a84b 35%,#f59e0b 65%,#dc2626);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;background:#faf6ec;">
                <p style="margin:0;font-size:11.5px;color:#8c8479;">🔒 © 2026 Smile Passport · This email and any attachments are confidential.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

function fieldRow(icon: string, label: string, value: string, accent: string) {
  return `
    <tr>
      <td style="padding:12px 16px;border-left:4px solid ${accent};background:#faf8f4;border-radius:10px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:28px;font-size:16px;vertical-align:top;">${icon}</td>
            <td>
              <p style="margin:0 0 2px;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:#8c8479;">${label}</p>
              <p style="margin:0;font-size:14.5px;font-weight:700;color:#1a1714;">${value}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
  `;
}

export function ownerNotificationEmail(lead: LeadForEmail) {
  const s = lead.smileScore != null ? scoreStyle(lead.smileScore) : null;
  const body = `
    <p style="margin:0 0 22px;color:#3d3831;font-size:14.5px;line-height:1.6;">
      🎉 A new patient just completed a smile scan and requested their report. Here are the details:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${fieldRow("👤", "Patient", lead.name, "#a07830")}
      ${fieldRow("✉️", "Email", lead.email, "#2563eb")}
      ${fieldRow("📱", "Phone", lead.phone, "#16a34a")}
    </table>
    ${lead.smileScore != null && s ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:6px;">
      <tr>
        <td style="background:${s.bg};border-radius:16px;padding:18px 20px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:64px;">
                <table cellpadding="0" cellspacing="0">
                  <tr><td style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,${s.ring1},${s.ring2});text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:17px;font-weight:900;">${lead.smileScore}</span>
                  </td></tr>
                </table>
              </td>
              <td>
                <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${s.fg};">AI Smile Score</p>
                <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:${s.fg};">${lead.smileScore} / 100</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : ""}
    <table cellpadding="0" cellspacing="0" style="margin-top:26px;">
      <tr>
        <td style="background:linear-gradient(135deg,#a07830,#d4a84b);border-radius:12px;box-shadow:0 4px 14px rgba(160,120,48,0.35);">
          <a href="${APP_URL}/doctor" style="display:inline-block;color:#ffffff;text-decoration:none;font-size:13.5px;font-weight:700;letter-spacing:0.04em;padding:15px 30px;">
            Review in Doctor CRM →
          </a>
        </td>
      </tr>
    </table>
  `;
  return {
    subject: `🦷 New Smile Scan Submission — ${lead.name}`,
    html: wrapper("New Patient Submission", "Someone just scanned their smile and is waiting on you.", body),
  };
}

export function patientReportEmail(lead: LeadForEmail) {
  const analysis: Analysis | null = lead.analysisJson ? JSON.parse(lead.analysisJson) : null;
  const s = lead.smileScore != null ? scoreStyle(lead.smileScore) : null;
  const firstName = lead.name.split(" ")[0];

  const scoreBlock = lead.smileScore != null && s ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:${s.bg};border-radius:18px;padding:22px 24px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="width:80px;">
                <table cellpadding="0" cellspacing="0">
                  <tr><td style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,${s.ring1},${s.ring2});text-align:center;vertical-align:middle;box-shadow:0 4px 12px rgba(0,0,0,0.12);">
                    <span style="color:#ffffff;font-size:22px;font-weight:900;">${lead.smileScore}</span>
                  </td></tr>
                </table>
              </td>
              <td style="padding-left:6px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${s.fg};">Your Smile Score</p>
                <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:${s.fg};">${lead.smileScore} out of 100</p>
                ${analysis?.overallImpression ? `<p style="margin:6px 0 0;font-size:13px;color:#3d3831;line-height:1.5;">${analysis.overallImpression}</p>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : "";

  const positivesBlock = analysis?.positives?.length ? `
    <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#15803d;">✅ What's looking good</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;">
      ${analysis.positives.map((p) => `
        <tr><td style="padding:8px 14px;background:#dcfce7;border-radius:10px;margin-bottom:6px;display:block;">
          <span style="color:#15803d;font-size:13.5px;">🌿 ${p}</span>
        </td></tr>
        <tr><td style="height:6px;font-size:0;">&nbsp;</td></tr>
      `).join("")}
    </table>` : "";

  const issuesBlock = analysis?.issues?.length ? `
    <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#946621;">🔍 Areas to keep an eye on</p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:22px;">
      ${analysis.issues.map((issue) => {
        const sev = SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.mild;
        return `
        <tr><td style="padding:14px 16px;background:#faf8f4;border-radius:12px;border-left:4px solid ${sev.fg};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13.5px;font-weight:700;color:#1a1714;">${issue.issue}</td>
              <td align="right">
                <span style="background:${sev.bg};color:${sev.fg};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:3px 9px;border-radius:999px;">${issue.severity}</span>
              </td>
            </tr>
          </table>
          ${issue.description ? `<p style="margin:6px 0 0;font-size:12.5px;color:#6b6459;line-height:1.5;">${issue.description}</p>` : ""}
          ${issue.suggestedTreatments?.length ? `<p style="margin:8px 0 0;font-size:12px;color:#a07830;font-weight:600;">💡 Suggested: ${issue.suggestedTreatments.join(", ")}</p>` : ""}
        </td></tr>
        <tr><td style="height:10px;font-size:0;">&nbsp;</td></tr>
      `;
      }).join("")}
    </table>` : "";

  const notesBlock = lead.doctorNotes?.trim() ? `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:linear-gradient(135deg,#fdf6e8,#faf1dd);border:1px solid #eadfc0;border-radius:14px;padding:18px 20px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#a07830;">🩺 Dentist's Personal Note</p>
          <p style="margin:0;font-size:13.5px;color:#3d3831;line-height:1.6;font-style:italic;">"${lead.doctorNotes}"</p>
        </td>
      </tr>
    </table>` : "";

  const body = `
    <p style="margin:0 0 6px;color:#1a1714;font-size:17px;font-weight:700;">Hi ${firstName}! 👋</p>
    <p style="margin:0 0 22px;color:#3d3831;font-size:14px;line-height:1.6;">
      Thank you for scanning your smile with us. Our dentist has personally reviewed your photos — your full
      personalised Smile Report is attached to this email as a PDF, and the highlights are right here too.
    </p>
    ${scoreBlock}
    ${positivesBlock}
    ${issuesBlock}
    ${notesBlock}
    <p style="margin:0 0 4px;color:#3d3831;font-size:13.5px;line-height:1.6;">
      Have questions about your report or want to discuss next steps? Just reply to this email — we're happy to help. 💬
    </p>
    <p style="margin:20px 0 0;color:#8c8479;font-size:13px;">With a smile, 😁<br/>The Smile Passport Team</p>
  `;
  return {
    subject: `😁 Your Smile Passport Report is Ready, ${firstName}!`,
    html: wrapper("Your Smile Report Has Arrived", "Personally reviewed by a licensed dentist, just for you.", body),
  };
}
