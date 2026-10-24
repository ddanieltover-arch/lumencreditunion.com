export interface EmailCta {
  label: string;
  url: string;
}

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailLayoutInput {
  appUrl: string;
  supportEmail: string;
  preheader?: string;
  headline: string;
  greetingName?: string;
  paragraphs: string[];
  details?: EmailDetailRow[];
  cta?: EmailCta;
  secondaryLinks?: EmailCta[];
  securityNote?: string;
  /** When true, omit the default “automated message” footer line. */
  omitAutomatedNotice?: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
