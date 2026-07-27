import type { NextConfig } from "next";
import { CACHE_PROFILES } from "./lib/server/cache/profiles";

const nextConfig: NextConfig = {
  // Enables the "use cache" directive plus cacheLife/cacheTag.
  cacheComponents: true,

  // Registered here so the profile names show up in Next's tooling; the cached
  // functions import the same objects from lib/server/cache/profiles.
  cacheLife: { ...CACHE_PROFILES },
};

export default nextConfig;
