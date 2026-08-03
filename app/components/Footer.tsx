import Link from "next/link";
import { Github } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Container } from "@/components/Container";

const footerLinks = {
  Product: [
    { label: "Capabilities", href: "#capabilities" },
    { label: "Models", href: "#models" },
    { label: "Testimonials", href: "#testimonials" },
  ],
  Resources: [
    { label: "GitHub", href: "https://github.com/oyedokunken/prompt-ai" },
    { label: "ARCHITECTURE.md", href: "/ARCHITECTURE.md" },
    { label: "CONTRIBUTING.md", href: "/CONTRIBUTING.md" },
    { label: "CHANGELOG", href: "/CHANGELOG.md" },
  ],
  Legal: [
    { label: "License (MIT)", href: "/LICENSE" },
    { label: "Security policy", href: "/SECURITY.md" },
  ],
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-16">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Logo variant="mono" size={28} />
            <p className="text-xs text-text-faint leading-relaxed max-w-[220px]">
              Open source. Built by developers, for developers.
            </p>
            <a
              href="https://github.com/oyedokunken/prompt-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-text-muted transition-colors focus-visible:outline-accent rounded"
            >
              <Github size={13} />
              oyedokunken/prompt-ai
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
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
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
