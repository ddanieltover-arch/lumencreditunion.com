import { escapeHtml } from './escape';
import type { EmailCta, EmailLayoutInput, RenderedEmail } from './types';

const COLORS = {
  teal: '#0A3D3F',
  tealMid: '#0F766E',
  amber: '#F5B942',
  ink: '#0E1B1F',
  surface: '#F4F7F6',
  border: '#DCE5E3',
  muted: '#4A5B60',
  subtle: '#8FA5A3',
  white: '#FFFFFF',
};

function ctaButton(cta: EmailCta): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
      <tr>
        <td align="center" bgcolor="${COLORS.teal}" style="border-radius:10px;">
          <a href="${escapeHtml(cta.url)}"
             style="display:inline-block;padding:14px 24px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${COLORS.white};text-decoration:none;border-radius:10px;background:${COLORS.teal};">
            ${escapeHtml(cta.label)}
          </a>
        </td>
      </tr>
    </table>`;
}

function detailsTable(rows: { label: string; value: string }[]): string {
  if (!rows.length) return '';
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};width:42%;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:13px;font-weight:600;color:${COLORS.ink};text-align:right;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:${COLORS.surface};border-radius:12px;padding:4px 16px;">
      ${body}
    </table>`;
}

export function renderLayout(input: EmailLayoutInput): { html: string; text: string } {
  const logoUrl = `${input.appUrl}/email/lumenfield-logo.png`;
  const greeting = input.greetingName
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLORS.ink};">Hi ${escapeHtml(input.greetingName)},</p>`
    : '';

  const paragraphs = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(p)}</p>`,
    )
    .join('');

  const ctaHtml = input.cta ? ctaButton(input.cta) : '';
  const ctaFallback = input.cta
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${COLORS.muted};">Or open this link:<br/><a href="${escapeHtml(input.cta.url)}" style="color:${COLORS.teal};word-break:break-all;">${escapeHtml(input.cta.url)}</a></p>`
    : '';

  const secondary =
    input.secondaryLinks && input.secondaryLinks.length
      ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${COLORS.muted};">${input.secondaryLinks
          .map(
            (l) =>
              `<a href="${escapeHtml(l.url)}" style="color:${COLORS.tealMid};font-weight:600;text-decoration:none;">${escapeHtml(l.label)}</a>`,
          )
          .join(' &nbsp;·&nbsp; ')}</p>`
      : '';

  const security = input.securityNote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${COLORS.subtle};">${escapeHtml(input.securityNote)}</p>`
    : '';

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.surface};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.surface};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${COLORS.white};border-radius:16px;overflow:hidden;border:1px solid ${COLORS.border};">
          <tr>
            <td style="background:${COLORS.teal};padding:22px 28px;">
              <a href="${escapeHtml(input.appUrl)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" alt="Lumenfield Credit Union" width="200" style="display:block;width:200px;max-width:70%;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${COLORS.amber};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${COLORS.teal};">${escapeHtml(input.headline)}</h1>
              ${greeting}
              ${paragraphs}
              ${detailsTable(input.details || [])}
              ${ctaHtml}
              ${ctaFallback}
              ${secondary}
              ${security}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;border-top:1px solid ${COLORS.border};">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${COLORS.subtle};">
                Lumenfield Credit Union · <a href="${escapeHtml(input.appUrl)}" style="color:${COLORS.tealMid};text-decoration:none;">${escapeHtml(input.appUrl.replace(/^https?:\/\//, ''))}</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.subtle};">
                Member Services: <a href="mailto:${escapeHtml(input.supportEmail)}" style="color:${COLORS.tealMid};text-decoration:none;">${escapeHtml(input.supportEmail)}</a>
              </p>
              ${
                input.omitAutomatedNotice
                  ? ''
                  : `<p style="margin:12px 0 0;font-size:11px;line-height:1.45;color:${COLORS.subtle};">This is an automated transactional message from Lumenfield Credit Union.</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts: string[] = [
    input.headline,
    '',
    input.greetingName ? `Hi ${input.greetingName},` : '',
    ...input.paragraphs,
  ].filter(Boolean) as string[];

  if (input.details?.length) {
    textParts.push('');
    for (const d of input.details) {
      textParts.push(`${d.label}: ${d.value}`);
    }
  }
  if (input.cta) {
    textParts.push('', `${input.cta.label}: ${input.cta.url}`);
  }
  if (input.secondaryLinks?.length) {
    textParts.push('');
    for (const l of input.secondaryLinks) {
      textParts.push(`${l.label}: ${l.url}`);
    }
  }
  if (input.securityNote) {
    textParts.push('', input.securityNote);
  }
  textParts.push(
    '',
    `— Lumenfield Credit Union`,
    input.appUrl,
    `Support: ${input.supportEmail}`,
  );

  return { html, text: textParts.join('\n') };
}

export function buildEmail(
  subject: string,
  layout: EmailLayoutInput,
): RenderedEmail {
  const { html, text } = renderLayout(layout);
  return { subject, html, text };
}
