# Changelog

All notable changes to this project are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and versioning follows [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-08-03

### Added

**Frontend**
- Complete marketing page with Hero, Problem, Capabilities, ChatPreview, DeviceFrame, ModelMarquee, Testimonials, ClosingCTA, and Integrations sections
- Chat-based Hero visualization showing user message bubble and AI structured prompt response with completeness score
- Problem section explaining the gap between vague input and unstated assumptions
- ChatPreview section with side-by-side chat exchange and inferred assumptions breakdown
- Two-row auto-scrolling testimonials marquee with real avatar images from i.pravatar.cc
- ModelMarquee with 14 AI models across two rows (Claude, GPT-4o, Gemini, Mistral, DeepSeek, Mixtral, Perplexity, Llama, Qwen, Command R+, Phi-3, etc.)
- Logo-only Integrations marquee showing compatible AI providers
- DeviceFrame section showing persistent workspace with prompt history
- Footer with large centered logo and centralized copyright block
- Header with mobile drawer navigation and CTA button
- ScrollToTop component for improved navigation
- Container component for universal section padding across all sections

**Documentation**
- System diagrams in README.md: architecture diagram, sequence diagram, data flow diagram, activity diagram, and component diagram using Mermaid syntax
- Updated WIKI.md to reference new system diagrams section
- Comprehensive CHANGELOG.md entry for initial release

**Styling**
- Dark theme with accent color (#F2A93B) and signal color (#8B7CF6)
- Tailwind CSS with custom color tokens
- Framer Motion animations for section reveals and interactive elements
- Responsive design with mobile-first approach
- Reduced motion support for accessibility

### Changed

- Hero section from CLI terminal to chat interface to align with chat-based product nature
- Testimonials from single-row dot navigation to two-row auto-scrolling marquee
- ModelMarquee expanded from 5+5 to 7+7 models with additional providers
- Footer layout to include large centered logo before copyright
- All sections now use shared Container component for consistent padding

### Notes

This is the initial release of Prompt AI, establishing the marketing site, documentation, and architectural foundation. The product is a chat-based tool that turns vague intent into structured prompts for AI models.
