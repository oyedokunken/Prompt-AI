"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#models", label: "Models" },
  { href: "#testimonials", label: "Testimonials" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
        "a, button, [tabindex]:not([tabindex='-1'])"
      );
      firstFocusable?.focus();
    } else {
      document.body.style.overflow = "";
      menuButtonRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!drawerOpen) return;
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          "a, button, [tabindex]:not([tabindex='-1'])"
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-base/90 backdrop-blur-md border-b border-border"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" aria-label="Prompt AI home">
              <Logo variant="color" size={28} />
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors rounded-md focus-visible:outline-accent"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/signup"
                className="hidden md:inline-flex items-center px-4 py-2 rounded-lg bg-accent text-base text-sm font-semibold hover:bg-accent/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                style={{ color: "#0A0A0B" }}
              >
                Start building
              </Link>
              <button
                ref={menuButtonRef}
                onClick={() => setDrawerOpen(true)}
                className="md:hidden p-2 rounded-md text-text-muted hover:text-text-primary focus-visible:outline-accent"
                aria-label="Open navigation menu"
                aria-expanded={drawerOpen}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[80vw] max-w-sm bg-surface border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between px-6 h-16 border-b border-border">
                <Logo variant="color" size={28} />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-md text-text-muted hover:text-text-primary focus-visible:outline-accent"
                  aria-label="Close navigation menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-1 p-4 flex-1" aria-label="Mobile navigation">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className="px-4 py-3 text-sm text-text-muted hover:text-text-primary hover:bg-raised rounded-lg transition-colors focus-visible:outline-accent"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="p-4 border-t border-border">
                <Link
                  href="/signup"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-3 rounded-lg bg-accent text-sm font-semibold hover:bg-accent/90 transition-colors focus-visible:outline-accent"
                  style={{ color: "#0A0A0B" }}
                >
                  Start building
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
