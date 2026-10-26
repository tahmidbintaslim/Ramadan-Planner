import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // next dev would otherwise write an untracked AGENTS.md when it detects an AI agent
  agentRules: false,
};

export default withNextIntl(nextConfig);
