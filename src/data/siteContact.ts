/**
 * Official public contact credentials for Lumenfield Credit Union.
 * Keep display copy and mailto links in sync with this source.
 */
export const SITE_CONTACT = {
  brandName: 'Lumenfield Credit Union',
  supportEmail: 'support@lumenfieldcu.com',
  websiteUrl: 'https://www.lumenfieldcu.com',
  websiteLabel: 'www.lumenfieldcu.com',
  hoursWeekdays: 'Monday – Friday, 9:00 AM – 5:00 PM (local)',
  hoursSaturday: 'Saturday, 10:00 AM – 1:00 PM (select branches)',
  mailingLabel: 'Member Services',
  mailingAddressLines: [
    'Lumenfield Credit Union',
    'Member Services',
    'Serving members in the USA, Canada, UK, and Europe',
  ],
} as const;

export const PUBLIC_NAV_LINKS = [
  { href: '#services', label: 'Services', kind: 'hash' as const },
  { href: '#how', label: 'How it works', kind: 'hash' as const },
  { href: '#visit', label: 'Visit us', kind: 'hash' as const },
  { href: '#countries', label: 'Countries', kind: 'hash' as const },
  { href: '#security', label: 'Security', kind: 'hash' as const },
  { href: '/contact', label: 'Contact', kind: 'route' as const },
] as const;
