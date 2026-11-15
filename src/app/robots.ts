import type { MetadataRoute } from "next";

// AI share links must stay out of search results and training sets, but stay readable when a person
// pastes one into their own AI. So search and training crawlers are told to skip /ai/, and everything
// else is left alone. The pages also send noindex headers as a backstop.
const SKIP_AI_LINKS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "YandexBot",
  "Baiduspider",
  "Slurp",
  "Applebot",
  "Google-Extended",
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: SKIP_AI_LINKS, disallow: ["/ai/", "/api/"] },
      { userAgent: "*", disallow: ["/api/"] },
    ],
  };
}
