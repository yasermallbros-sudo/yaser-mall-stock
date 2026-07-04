import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"],
  images: { remotePatterns: [{ protocol: "https", hostname: "yasermallonline.com" }, { protocol: "https", hostname: "**.yasermallonline.com" }] }
};
export default nextConfig;
