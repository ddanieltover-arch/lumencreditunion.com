import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LumenLogo } from './LumenLogo';
import { CountryServiceInfo } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  Send,
  Download,
  Car,
  Home,
  CreditCard,
  FileCheck,
  Check,
  Lock,
  Globe2,
  X,
  FileText,
  BadgeCheck,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const {
    setCurrentView,
    setMemberTab,
    setAdminTab,
    activeMember,
    countries,
    openAuthModal,
    openTermsModal,
    openPrivacyModal,
  } = useApp();

  const [selectedCountry, setSelectedCountry] = useState<CountryServiceInfo | null>(null);
  const [showTestAccountModal, setShowTestAccountModal] = useState<boolean>(false);

  const handleOpenAccount = () => {
    openAuthModal('login');
  };

  const handleRegisterAccount = () => {
    openAuthModal('register');
  };

  const handleOpenAdmin = () => {
    setCurrentView('admin');
    setAdminTab('fund_wallet');
  };

  return (
    <div className="w-full min-h-screen bg-[#F4F7F6] text-[#0E1B1F] flex flex-col font-sans selection:bg-[#F5B942]/30 selection:text-[#0A3D3F]">
      {/* ── TOP NAVIGATION ── */}
      <header className="w-full bg-[#0E1B1F] text-white border-b border-[#0A3D3F]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-6">
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="hover:opacity-90 transition-opacity"
          >
            <LumenLogo size={34} textColor="#FFFFFF" />
          </a>

          {/* Navigation Links */}
          <nav
            aria-label="Public navigation"
            className="hidden md:flex items-center gap-7 text-[15px] font-medium"
          >
            <a
              href="#services"
              className="text-[#D6E8E6] hover:text-white transition-colors py-2"
            >
              Services
            </a>
            <a
              href="#how"
              className="text-[#D6E8E6] hover:text-white transition-colors py-2"
            >
              How it works
            </a>
            <a
              href="#countries"
              className="text-[#D6E8E6] hover:text-white transition-colors py-2"
            >
              Countries
            </a>
            <a
              href="#security"
              className="text-[#D6E8E6] hover:text-white transition-colors py-2"
            >
              Security
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAccount}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[10px] border border-[#5E9A97] text-white hover:bg-[#0A3D3F] transition-all font-semibold text-[15px] cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setShowTestAccountModal(true)}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-[10px] bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] transition-all font-semibold text-[15px] shadow-sm cursor-pointer"
            >
              Open a test account
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="bg-[#0A3D3F] text-white px-6 pt-12 pb-24 border-b border-[#0A3D3F]">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-14">
          {/* Left Hero Column */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <div className="inline-flex self-start items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F5557] text-[#F5D78E] text-[13px] font-semibold tracking-wide border border-[#2D7A77]/60">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5B942]" />
              Private sandbox, invitation only
            </div>

            <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-[58px] leading-[1.08] tracking-[-0.02em]">
              Money that moves the way you do.
            </h1>

            <p className="text-[17px] sm:text-[18px] leading-[1.6] text-[#D6E8E6] max-w-[560px]">
              One wallet for everyday spending, transfers between members, bank and crypto movements, and loans for your next car or home. Built for members in the USA, Canada, the UK and Europe.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => setShowTestAccountModal(true)}
                className="inline-flex items-center justify-center min-h-[50px] px-7 rounded-xl bg-[#F5B942] hover:bg-[#f0b033] text-[#0E1B1F] font-semibold text-[15px] shadow-md transition-all cursor-pointer group"
              >
                Open a test account
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <a
                href="#how"
                className="inline-flex items-center justify-center min-h-[50px] px-6 rounded-xl border border-[#5E9A97] text-white hover:bg-white/10 font-semibold text-[15px] transition-all"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right Hero Column: Interactive Teaser Widget matching Mockup */}
          <div className="w-full lg:w-[460px] shrink-0 bg-[#0E1B1F] border border-[#2D7A77] rounded-[24px] p-7 flex flex-col gap-6 shadow-2xl">
            {/* Top Balance Preview */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-[#5E9A97] font-semibold uppercase tracking-wider">
                <span>Available balance (test funds)</span>
                <span className="px-2 py-0.5 rounded bg-[#0A3D3F] text-[#F5D78E] font-mono text-[11px]">
                  USD
                </span>
              </div>
              <div className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                ${activeMember.wallets.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('member');
                  setMemberTab('transfers');
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-[#D6E8E6] hover:text-white transition-all text-xs font-semibold cursor-pointer border border-[#2D7A77]/40"
              >
                <Send className="w-4 h-4 text-[#F5B942]" />
                <span>Send</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentView('admin');
                  setAdminTab('fund_wallet');
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-[#D6E8E6] hover:text-white transition-all text-xs font-semibold cursor-pointer border border-[#2D7A77]/40"
              >
                <Download className="w-4 h-4 text-[#F5B942]" />
                <span>Fund</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentView('member');
                  setMemberTab('loans');
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-[#D6E8E6] hover:text-white transition-all text-xs font-semibold cursor-pointer border border-[#2D7A77]/40"
              >
                <Car className="w-4 h-4 text-[#F5B942]" />
                <span>Apply</span>
              </button>
            </div>

            {/* Virtual Card Preview */}
            <div className="bg-[#F5B942] text-[#0E1B1F] rounded-[18px] p-5 flex flex-col justify-between h-[168px] shadow-lg relative overflow-hidden group transition-transform hover:-translate-y-0.5">
              {/* Background card texture wave */}
              <div className="absolute right-0 bottom-0 w-36 h-36 bg-[#0E1B1F]/5 rounded-full blur-xl pointer-events-none" />

              <div className="flex items-center justify-between font-display font-bold text-sm">
                <span className="tracking-tight text-base">Lumenfield</span>
                <span className="font-mono text-[10px] uppercase font-bold tracking-widest bg-[#0E1B1F] text-[#F5B942] px-1.5 py-0.5 rounded">
                  VIRTUAL · TEST
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Chip SVG */}
                <div className="w-9 h-7 rounded-sm bg-[#5A4100]/25 border border-[#5A4100]/40 flex flex-col justify-center gap-0.5 px-1">
                  <div className="w-full h-0.5 bg-[#5A4100]/50" />
                  <div className="w-full h-0.5 bg-[#5A4100]/50" />
                </div>
                {/* Contactless */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0E1B1F]/70">
                  <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                  <path d="M12 19a9 9 0 0 0 0-14" />
                </svg>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="font-mono font-semibold text-base tracking-[0.16em]">
                    {activeMember.virtualCard.cardNumber}
                  </div>
                  <div className="text-[11px] font-semibold text-[#0E1B1F]/80 uppercase mt-0.5">
                    {activeMember.virtualCard.cardholderName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-[#0E1B1F]/60">Valid Thru</div>
                  <div className="font-mono font-bold text-xs">{activeMember.virtualCard.expiryDate}</div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleOpenAccount}
                className="text-xs text-[#5E9A97] hover:text-[#D6E8E6] transition-colors underline underline-offset-4 cursor-pointer"
              >
                View live interactive member dashboard →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT YOU CAN DO (SERVICES) ── */}
      <section id="services" className="py-20 px-6 bg-[#F4F7F6]">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-bold text-[#0F766E] uppercase tracking-widest">
              WHAT YOU CAN DO
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#0E1B1F] tracking-[-0.02em]">
              Everyday money, under one roof
            </h2>
            <p className="text-[17px] text-[#4A5B60] max-w-2xl leading-relaxed">
              Move money, borrow for big purchases and keep track of everything from a single dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <Globe2 className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Multi-currency wallet
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Hold balances in USD, CAD, GBP and EUR with a clear statement for every movement. Instant sandbox swaps at real-time market rates.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <Send className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Transfers
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Send to another member instantly, move funds by bank transfer (ACH/Wire), or explore test crypto rails for cross-border settlement.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <Car className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Auto loans
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Apply online, upload your vehicle documents and track your application from submission to decision with fixed rates and no prepayment penalties.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <Home className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Mortgage loans
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Start a home loan application and see your repayment schedule and estimated amortized interest before committing.
              </p>
            </div>

            {/* Card 5 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <CreditCard className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Virtual cards
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Create a card in seconds, freeze it anytime with a single tap, and configure your own daily and monthly spending limits.
              </p>
            </div>

            {/* Card 6 */}
            <div className="bg-white border border-[#DCE5E3] rounded-[20px] p-7 flex flex-col gap-3 hover:border-[#0F766E] transition-all shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-[#E3F3F1] text-[#0A3D3F] flex items-center justify-center mb-1">
                <FileCheck className="w-6 h-6 text-[#0F766E]" />
              </div>
              <h3 className="font-display font-bold text-xl text-[#0E1B1F]">
                Verified identity
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Upload a passport, national ID card, residence permit or driver’s license for compliance review and tier-based limits.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-20 px-6 bg-white border-y border-[#DCE5E3]">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-bold text-[#0F766E] uppercase tracking-widest">
              HOW IT WORKS
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#0E1B1F] tracking-[-0.02em]">
              Three steps to your first transfer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-[#F4F7F6] border border-[#DCE5E3] rounded-[20px] p-8 flex flex-col gap-4 relative">
              <div className="w-10 h-10 rounded-full bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-base">
                1
              </div>
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                Verify your identity
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Create your account, then upload a government-issued document. An administrator reviews it in the sandbox queue.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#F4F7F6] border border-[#DCE5E3] rounded-[20px] p-8 flex flex-col gap-4 relative">
              <div className="w-10 h-10 rounded-full bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-base">
                2
              </div>
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                Fund your wallet
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                In this sandbox, an administrator credits your wallet with test funds, and every credit is balanced on the immutable ledger.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#F4F7F6] border border-[#DCE5E3] rounded-[20px] p-8 flex flex-col gap-4 relative">
              <div className="w-10 h-10 rounded-full bg-[#0A3D3F] text-[#F5B942] flex items-center justify-center font-display font-bold text-base">
                3
              </div>
              <h3 className="font-display font-bold text-lg text-[#0E1B1F]">
                Send, spend or borrow
              </h3>
              <p className="text-[15px] leading-relaxed text-[#4A5B60]">
                Pay other members, request external bank clearing, simulate card checkout, or apply for an auto or mortgage loan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHERE WE SERVE (COUNTRIES) ── */}
      <section id="countries" className="py-20 px-6 bg-[#F4F7F6]">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-start gap-12">
          <div className="flex-1 flex flex-col gap-3">
            <span className="text-[13px] font-bold text-[#0F766E] uppercase tracking-widest">
              WHERE WE SERVE
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#0E1B1F] tracking-[-0.02em]">
              Starting in North America and Europe
            </h2>
            <p className="text-[17px] text-[#4A5B60] leading-relaxed">
              Each country has its own currency, accepted ID documents and loan rules. Click any jurisdiction to review sandbox verification requirements.
            </p>
          </div>

          <div className="flex-1 flex flex-wrap gap-2.5">
            {countries.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCountry(c)}
                className="px-5 py-3 rounded-full border border-[#CFDAD8] bg-white hover:border-[#0A3D3F] hover:bg-[#E3F3F1] transition-all font-medium text-sm text-[#0E1B1F] cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <span>{c.name}</span>
                <span className="text-xs font-mono text-[#0F766E] font-semibold bg-[#0F766E]/10 px-2 py-0.5 rounded-full">
                  {c.currency}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY & DOUBLE-ENTRY LEDGER ── */}
      <section id="security" className="py-20 px-6 bg-[#0A3D3F] text-white">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="text-[13px] font-bold text-[#F5B942] uppercase tracking-widest">
              SECURITY & GOVERNANCE
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-[-0.02em]">
              Designed so every movement can be traced
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="border border-[#2D7A77] rounded-[20px] p-6 flex flex-col gap-2.5 bg-[#0F5557]/40">
              <ShieldCheck className="w-6 h-6 text-[#F5D78E] mb-1" />
              <h3 className="font-display font-bold text-lg text-[#F5D78E]">
                Two-step sign-in
              </h3>
              <p className="text-[14px] leading-relaxed text-[#C9DEDC]">
                Multi-factor authentication protects every account access and authorization.
              </p>
            </div>

            <div className="border border-[#2D7A77] rounded-[20px] p-6 flex flex-col gap-2.5 bg-[#0F5557]/40">
              <Lock className="w-6 h-6 text-[#F5D78E] mb-1" />
              <h3 className="font-display font-bold text-lg text-[#F5D78E]">
                Private document storage
              </h3>
              <p className="text-[14px] leading-relaxed text-[#C9DEDC]">
                Identity documents are encrypted and visible only to verified compliance reviewers.
              </p>
            </div>

            <div className="border border-[#2D7A77] rounded-[20px] p-6 flex flex-col gap-2.5 bg-[#0F5557]/40">
              <FileText className="w-6 h-6 text-[#F5D78E] mb-1" />
              <h3 className="font-display font-bold text-lg text-[#F5D78E]">
                Double-entry ledger
              </h3>
              <p className="text-[14px] leading-relaxed text-[#C9DEDC]">
                Every credit and debit is balanced in a ledger that cannot be silently modified.
              </p>
            </div>

            <div className="border border-[#2D7A77] rounded-[20px] p-6 flex flex-col gap-2.5 bg-[#0F5557]/40">
              <BadgeCheck className="w-6 h-6 text-[#F5D78E] mb-1" />
              <h3 className="font-display font-bold text-lg text-[#F5D78E]">
                Full audit trail
              </h3>
              <p className="text-[14px] leading-relaxed text-[#C9DEDC]">
                Administrator actions, including wallet funding, are logged with who, when, and why.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRE-FOOTER CTA ── */}
      <section className="py-20 px-6 bg-[#F4F7F6]">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-8 bg-white border border-[#DCE5E3] rounded-3xl p-10 shadow-sm">
          <div className="flex flex-col gap-3 max-w-xl">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#0E1B1F] tracking-tight">
              Try the sandbox
            </h2>
            <p className="text-[16px] text-[#4A5B60] leading-relaxed">
              Create a test account, submit sample verification documents, and test wallet transfers, loans, and admin ledger credits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenAccount}
              className="inline-flex items-center justify-center min-h-[50px] px-7 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-[15px] transition-all cursor-pointer shadow-md"
            >
              Open a test account
            </button>
            <button
              type="button"
              onClick={handleOpenAdmin}
              className="inline-flex items-center justify-center min-h-[50px] px-6 rounded-xl border border-[#BCCAC8] hover:bg-slate-50 text-[#0E1B1F] font-semibold text-[15px] transition-all cursor-pointer"
            >
              Admin funding console
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mt-auto py-10 px-6 bg-[#0E1B1F] text-[#B9C7C6] border-t border-[#0A3D3F]">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
          <div className="flex flex-wrap justify-between items-center gap-6">
            <LumenLogo size={28} textColor="#FFFFFF" />

            <div className="flex flex-wrap items-center gap-6 text-sm">
              <a href="#services" className="hover:text-white transition-colors">
                Services
              </a>
              <a href="#security" className="hover:text-white transition-colors">
                Security
              </a>
              <button
                type="button"
                onClick={openPrivacyModal}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={openTermsModal}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={handleOpenAdmin}
                className="text-[#F5B942] hover:underline cursor-pointer"
              >
                Administrator Portal
              </button>
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-[#8FA5A3] max-w-4xl pt-2 border-t border-white/10">
            Lumenfield is a financial software sandbox. Balances shown are test funds, not real money. Product names, rates and eligibility will be confirmed once a regulated partner is in place.
          </p>
        </div>
      </footer>

      {/* ── COUNTRY DETAILS MODAL ── */}
      {selectedCountry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Country Profile
                </span>
                <h3 className="font-display font-bold text-2xl text-[#0E1B1F] mt-1">
                  {selectedCountry.name} ({selectedCountry.code})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCountry(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                <div className="text-xs text-[#4A5B60]">Primary Currency</div>
                <div className="font-bold text-base text-[#0E1B1F]">
                  {selectedCountry.currency} ({selectedCountry.currencySymbol})
                </div>
              </div>

              <div className="p-3 bg-[#F4F7F6] rounded-xl border border-[#DCE5E3]">
                <div className="text-xs text-[#4A5B60]">Sandbox Status</div>
                <div className="font-bold text-sm text-[#0F766E]">
                  {selectedCountry.status}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A5B60] mb-2">
                Accepted Identity Documents
              </h4>
              <ul className="space-y-1.5 text-sm text-[#0E1B1F]">
                {(selectedCountry.acceptedDocs || selectedCountry.acceptedIdTypes || []).map((doc, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0F766E] shrink-0" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-[#DCE5E3] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCountry(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0A3D3F] text-white font-semibold text-sm hover:bg-[#0F5557]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEST ACCOUNT ONBOARDING MODAL ── */}
      {showTestAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#DCE5E3] shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">
                  Test Sandbox
                </span>
                <h3 className="font-display font-bold text-2xl text-[#0E1B1F] mt-1">
                  Welcome to Lumenfield
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTestAccountModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[#4A5B60] leading-relaxed">
              You are entering the prototype sandbox environment. An initial test member profile (<span className="font-semibold text-slate-800">Test Member, LF-000124</span>) is preloaded with USD $12,450.00, virtual card, auto loan under review, and live double-entry ledger integration.
            </p>

            <div className="p-4 bg-[#FFF1CC] rounded-xl border border-[#F0D58A] text-xs text-[#5A4100] leading-relaxed">
              <strong>Notice:</strong> All funds are fictitious test balances. You can fund wallets, send money between members, freeze virtual cards, and post double-entry credits.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTestAccountModal(false);
                  setCurrentView('member');
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0A3D3F] hover:bg-[#0F5557] text-white font-semibold text-sm transition-all text-center"
              >
                Launch Member Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTestAccountModal(false);
                  setCurrentView('admin');
                }}
                className="py-3 px-4 rounded-xl border border-[#BCCAC8] text-[#0E1B1F] font-semibold text-sm hover:bg-slate-50 transition-all text-center"
              >
                Admin Console
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
