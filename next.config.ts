import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Demo product images (also sent to Stripe Checkout via products.x.images).
    remotePatterns: [{ protocol: "https", hostname: "placehold.co", pathname: "/**" }],
  },
};

export default nextConfig;
