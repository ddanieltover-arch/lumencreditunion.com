import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PublicChrome } from './PublicChrome';
import { SITE_CONTACT } from '../data/siteContact';
import { FadeUp, TapScale, MOTION } from '../motion';
import { Mail, Globe2, Clock, MapPin, ArrowRight, Send } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Member support');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      '',
      message.trim(),
    ].join('\n');

    const mailto = `mailto:${SITE_CONTACT.supportEmail}?subject=${encodeURIComponent(
      subject.trim() || 'Member support',
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    showToast('Opening your email app to reach Member Services.', 'info');
    setSending(false);
  };

  return (
    <PublicChrome resolveHashesViaHome>
      <section className="relative min-h-[320px] flex items-end text-white overflow-hidden">
        <img
          src="/images/branch-interior.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#0E1B1F]/92 via-[#0A3D3F]/55 to-[#0A3D3F]/30"
          aria-hidden="true"
        />
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 py-14 sm:py-16">
          <FadeUp inView={false} distance={MOTION.distance.sm}>
            <span className="text-[13px] font-bold text-[#F5D78E] uppercase tracking-widest">
              Contact us
            </span>
          </FadeUp>
          <FadeUp inView={false} delay={0.06} distance={MOTION.distance.md}>
            <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-[-0.02em] mt-2 max-w-[16ch]">
              We&apos;re here for our members.
            </h1>
          </FadeUp>
          <FadeUp inView={false} delay={0.12} distance={MOTION.distance.sm}>
            <p className="mt-3 text-[17px] text-[#D6E8E6] max-w-xl leading-relaxed">
              Reach Lumenfield Member Services with the credentials below, or send a message and we will follow up by email.
            </p>
          </FadeUp>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          <FadeUp className="flex flex-col gap-6" distance={MOTION.distance.md}>
            <div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#0E1B1F] tracking-tight">
                Our credentials
              </h2>
              <p className="mt-2 text-[15px] text-[#4A5B60] leading-relaxed">
                Official public contact details for {SITE_CONTACT.brandName}.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <a
                href={`mailto:${SITE_CONTACT.supportEmail}`}
                className="flex items-start gap-4 p-5 rounded-2xl border border-[#DCE5E3] bg-white hover:border-[#0F766E] transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-[#E3F3F1] text-[#0F766E] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#4A5B60]">
                    Support email
                  </span>
                  <span className="block mt-1 font-semibold text-[#0E1B1F] text-[15px]">
                    {SITE_CONTACT.supportEmail}
                  </span>
                </span>
              </a>

              <a
                href={SITE_CONTACT.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-5 rounded-2xl border border-[#DCE5E3] bg-white hover:border-[#0F766E] transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-[#E3F3F1] text-[#0F766E] flex items-center justify-center shrink-0">
                  <Globe2 className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#4A5B60]">
                    Website
                  </span>
                  <span className="block mt-1 font-semibold text-[#0E1B1F] text-[15px]">
                    {SITE_CONTACT.websiteLabel}
                  </span>
                </span>
              </a>

              <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#DCE5E3] bg-white">
                <span className="w-11 h-11 rounded-xl bg-[#E3F3F1] text-[#0F766E] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#4A5B60]">
                    Member services hours
                  </span>
                  <p className="mt-1 font-semibold text-[#0E1B1F] text-[15px]">
                    {SITE_CONTACT.hoursWeekdays}
                  </p>
                  <p className="mt-0.5 text-[14px] text-[#4A5B60]">
                    {SITE_CONTACT.hoursSaturday}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-2xl border border-[#DCE5E3] bg-white">
                <span className="w-11 h-11 rounded-xl bg-[#E3F3F1] text-[#0F766E] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </span>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#4A5B60]">
                    {SITE_CONTACT.mailingLabel}
                  </span>
                  {SITE_CONTACT.mailingAddressLines.map((line) => (
                    <p key={line} className="mt-0.5 font-medium text-[#0E1B1F] text-[15px] first:mt-1">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.08} className="bg-white border border-[#DCE5E3] rounded-3xl p-7 sm:p-8 shadow-xs" distance={MOTION.distance.md}>
            <h2 className="font-display font-bold text-2xl text-[#0E1B1F] tracking-tight">
              Send a message
            </h2>
            <p className="mt-2 text-[14px] text-[#4A5B60] leading-relaxed">
              Messages are routed to {SITE_CONTACT.supportEmail} through your email client.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  Full name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F]"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  Subject
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F]"
                >
                  <option>Member support</option>
                  <option>Account access</option>
                  <option>Transfers &amp; wallets</option>
                  <option>Loans</option>
                  <option>Identity verification</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-semibold text-[#0E1B1F] mb-1.5">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl border border-[#DCE5E3] bg-[#F4F7F6] text-sm text-[#0E1B1F] focus:outline-none focus:ring-2 focus:ring-[#0A3D3F] resize-y min-h-[120px]"
                  placeholder="How can we help?"
                />
              </div>

              <TapScale>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-[15px] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  Send message
                  <ArrowRight className="w-4 h-4" />
                </button>
              </TapScale>
            </form>
          </FadeUp>
        </div>
      </section>
    </PublicChrome>
  );
};
