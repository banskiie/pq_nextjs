'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'ongoing', label: 'Matches', href: '/ongoing', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'payments', label: 'Payments', href: '/payments', icon: 'M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 10H6L5 9z' },
  { id: 'players', label: 'Players', href: '/players', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3a6 6 0 016-6h6a6 6 0 016 6v0a3 3 0 01-3 3H6a3 3 0 01-3-3v0a6 6 0 016-6h6a6 6 0 016 6zM12 14a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'courts', label: 'Courts', href: '/courts', icon: 'M3 3h18v18H3V3zm0 9h18M12 3v18' },
  { id: 'records', label: 'Records', href: '/records', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const handleNavClick = (href) => {
    if (href !== pathname) {
      setIsNavigating(true);
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {isNavigating && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="w-[min(90vw,22rem)] rounded-xl border border-white/10 bg-slate-900/95 p-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
            <p className="text-sm font-semibold text-white">Loading page...</p>
            <p className="mt-1 text-xs text-slate-400">Opening the selected page.</p>
          </div>
        </div>
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-slate-900/90 p-2 text-white backdrop-blur-sm border border-white/10 lg:hidden"
        aria-label="Toggle menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-slate-900/95 backdrop-blur-sm border-r border-white/10 shadow-2xl z-40 transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex h-full flex-col">
          {/* Navbar Header */}
          <div className="border-b border-white/10 bg-slate-900/90 p-6 pl-16 lg:pl-6">
            <div className="mb-4 flex items-center justify-center">
              <Image
                src="/LOGO-NEW-SPORTSCENTER.png"
                alt="Sport Center Logo"
                width={112}
                height={112}
                style={{ width: '112px', height: 'auto' }}
                priority
              />
            </div>
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Navigation</h2>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Browse sessions and matches
            </p>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  scroll={false}
                  onClick={() => handleNavClick(item.href)}
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
                    isActive(item.href)
                      ? 'bg-emerald-500/20 text-emerald-200 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </nav>

          {/* Open Waiting Room in New Tab */}
          <div className="border-t border-white/10 bg-slate-900/90 p-4">
            <button
              onClick={() => window.open('/waiting-room', '_blank')}
              className="w-full flex items-center gap-3 rounded-lg bg-emerald-500/20 px-4 py-3 text-left text-emerald-200 font-semibold transition hover:bg-emerald-500/30"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Waiting Room</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
