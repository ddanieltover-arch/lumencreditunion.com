import { buildEmail } from '../layout';
import type { RenderedEmail } from '../types';

export function contactConfirmationEmail(params: {
  appUrl: string;
  supportEmail: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
}): RenderedEmail {
  return buildEmail('We received your message', {
    appUrl: params.appUrl,
    supportEmail: params.supportEmail,
    preheader: 'Lumenfield Member Services will follow up by email.',
    headline: 'Message received',
    greetingName: params.visitorName,
    paragraphs: [
      'Thank you for contacting Lumenfield Credit Union. We received your message and will follow up by email.',
    ],
    details: [
      { label: 'Subject', value: params.subject },
      { label: 'Reply-to', value: params.visitorEmail },
    ],
    cta: { label: 'Visit Lumenfield', url: params.appUrl },
    omitAutomatedNotice: true,
  });
}

export function contactSupportInboxEmail(params: {
  appUrl: string;
  supportEmail: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  message: string;
}): RenderedEmail {
  return buildEmail(`[Contact] ${params.subject}`, {
    appUrl: params.appUrl,
    supportEmail: params.supportEmail,
    preheader: `New contact form message from ${params.visitorName}.`,
    headline: 'New contact form message',
    paragraphs: [
      'A visitor submitted the public contact form on lumenfieldcu.com.',
      params.message,
    ],
    details: [
      { label: 'Name', value: params.visitorName },
      { label: 'Email', value: params.visitorEmail },
      { label: 'Subject', value: params.subject },
    ],
    cta: {
      label: `Reply to ${params.visitorName}`,
      url: `mailto:${encodeURIComponent(params.visitorEmail)}?subject=${encodeURIComponent(`Re: ${params.subject}`)}`,
    },
    omitAutomatedNotice: true,
  });
}
