"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/* ─────────────────────────────────────────────────────────────── */

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    setIos(detectIOS());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  // iOS always shows (manual flow); others only show when prompt is ready
  if (!ios && !deferredPrompt) return null;

  async function handleClick() {
    if (ios) {
      setShowGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    setLoading(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setDeferredPrompt(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/*
       * Mobile (<sm): fixed floating pill at bottom-right.
       * Sits outside the NavBar so it never squishes the portal tabs.
       */}
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label="Install app"
        className={`
          sm:hidden fixed bottom-5 right-4 z-40
          flex items-center gap-2
          rounded-full bg-blue-600 border border-blue-500/70
          shadow-lg shadow-blue-950/60
          px-4 py-3 text-sm font-semibold text-white
          hover:bg-blue-500 active:scale-95
          transition-all duration-150 disabled:opacity-60
        `}
      >
        <DownloadIcon loading={loading} size={16} />
        {loading ? "Saving…" : "Install"}
      </button>

      {/*
       * Desktop (sm+): compact inline button inside the NavBar.
       * Hidden on mobile so it doesn't crowd the nav tabs.
       */}
      <button
        onClick={handleClick}
        disabled={loading}
        title="Install this app on your device"
        className={`
          hidden sm:flex items-center gap-1.5 flex-shrink-0
          rounded-lg border border-blue-500/50 bg-blue-500/20
          px-3 py-1.5 text-xs font-semibold text-blue-300
          hover:bg-blue-500/30 hover:border-blue-400/70 hover:text-blue-200
          active:scale-95 transition-all duration-150
          disabled:opacity-50 whitespace-nowrap
        `}
      >
        <DownloadIcon loading={loading} size={13} />
        {loading ? "Saving…" : "Install App"}
      </button>

      {showGuide && <IOSGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}

/* ── download / spinner icon ─────────────────────────── */
function DownloadIcon({ loading, size }: { loading: boolean; size: number }) {
  if (loading) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
        <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="10" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5v8" />
      <path d="M5.5 7.5L8 10l2.5-2.5" />
      <path d="M2.5 11.5v1A1.5 1.5 0 004 14h8a1.5 1.5 0 001.5-1.5v-1" />
    </svg>
  );
}

/* ── iOS step-by-step guide ──────────────────────────── */
function IOSGuide({ onClose }: { onClose: () => void }) {
  const isSafari =
    typeof navigator !== "undefined" &&
    /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/*
       * Bottom sheet on mobile, centered dialog on desktop.
       * The pointer-events-none wrapper lets clicks on the backdrop
       * fall through; the inner card re-enables them.
       */}
      <div className="fixed z-50 inset-0 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How to install"
          className="pointer-events-auto w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0b1d33] border border-white/10 shadow-2xl px-6 pt-5 pb-8 sm:pb-6"
        >
          {/* drag handle – mobile only */}
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5 sm:hidden" />

          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-base font-bold text-white">Install Zao Works</p>
              <p className="text-xs text-white/45 mt-0.5">
                {isSafari
                  ? "Follow the steps below in Safari"
                  : "Open this page in Safari for the best experience"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </div>

          <ol className="space-y-4">
            {isSafari ? (
              <>
                <Step n={1} icon={<IconShare />}>
                  Tap the <strong className="text-white">Share</strong> button{" "}
                  <span className="text-white/40 text-xs">(bottom toolbar)</span>
                </Step>
                <Step n={2} icon={<IconPlus />}>
                  Scroll down and tap{" "}
                  <strong className="text-white">"Add to Home Screen"</strong>
                </Step>
                <Step n={3} icon={<IconCheck />}>
                  Tap <strong className="text-white">Add</strong> to confirm
                </Step>
              </>
            ) : (
              <>
                <Step n={1} icon={<IconSafari />}>
                  Open this page in <strong className="text-white">Safari</strong>
                </Step>
                <Step n={2} icon={<IconShare />}>
                  Tap the <strong className="text-white">Share</strong> button
                </Step>
                <Step n={3} icon={<IconPlus />}>
                  Tap <strong className="text-white">"Add to Home Screen"</strong>
                </Step>
              </>
            )}
          </ol>

          {isSafari && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2.5">
              <IconShare className="text-blue-400 shrink-0" />
              <span className="text-xs text-white/50 leading-snug">
                The share icon is a box with an upward arrow — in Safari's bottom bar
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="shrink-0 h-7 w-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[11px] font-bold text-blue-300">
        {n}
      </span>
      <span className="flex items-center gap-2 text-sm text-white/65 leading-snug">
        <span className="text-white/40 shrink-0">{icon}</span>
        <span>{children}</span>
      </span>
    </li>
  );
}

/* ── tiny SVG icons ──────────────────────────────────── */
function IconShare({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="12" height="10" rx="2" />
      <path d="M10 1v11M7 4l3-3 3 3" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <path d="M10 7v6M7 10h6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10l4.5 4.5L16 6" />
    </svg>
  );
}

function IconSafari() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18" />
      <path d="M13.5 6.5L11 11 6.5 13.5 9 9l4.5-2.5z" />
    </svg>
  );
}
