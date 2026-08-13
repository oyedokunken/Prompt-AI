import Link from "next/link";
import { Github } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Container } from "@/components/Container";

const footerLinks = {
  Product: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#capabilities" },
    { label: "Models", href: "#models" },
    { label: "Who it is for", href: "#who-its-for" },
    { label: "FAQ", href: "#faq" },
  ],
  Developers: [
    { label: "GitHub", href: "https://github.com/oyedokunken/Prompt-AI" },
    { label: "Architecture", href: "https://github.com/oyedokunken/Prompt-AI/blob/main/ARCHITECTURE.md" },
    { label: "Contributing", href: "https://github.com/oyedokunken/Prompt-AI/blob/main/CONTRIBUTING.md" },
    { label: "Changelog", href: "https://github.com/oyedokunken/Prompt-AI/blob/main/CHANGELOG.md" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "mailto:hello@promptgpt.app" },
  ],
  Legal: [
    { label: "License (MIT)", href: "https://github.com/oyedokunken/Prompt-AI/blob/main/LICENSE" },
    { label: "Security policy", href: "https://github.com/oyedokunken/Prompt-AI/blob/main/SECURITY.md" },
    { label: "Privacy", href: "#" },
  ],
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-16">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-14">
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-4">
            <Logo variant="mono" size={28} />
            <p className="text-xs text-text-faint leading-relaxed max-w-[220px]">
              Prompt engineering, automated. Open source and built for developers.
            </p>
            <a
              href="https://github.com/oyedokunken/Prompt-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
            >
              <Github size={13} />
              oyedokunken/Prompt-AI
            </a>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="font-mono text-xs text-text-faint uppercase tracking-widest mb-4">
                {group}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
                      {...(link.href.startsWith("http") || link.href.startsWith("mailto")
                        ? { target: link.href.startsWith("mailto") ? undefined : "_blank", rel: link.href.startsWith("http") ? "noopener noreferrer" : undefined }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center py-14">
          <Logo variant="color" size={88} />
        </div>

        <div className="border-t border-border-subtle pt-6 flex flex-col items-center text-center gap-1.5">
          <p className="text-xs text-text-faint">
            &copy; {year} Prompt AI. Released under the MIT License.
          </p>
          <p className="text-xs text-text-faint">
            Open source project. Not affiliated with any AI lab or provider.
          </p>
        </div>
      </Container>
    </footer>
  );
}
