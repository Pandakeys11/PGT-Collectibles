/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three", "@react-three/fiber"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/liquid-scan",
        permanent: false,
      },
      {
        source: "/redesign",
        destination: "/liquid-scan",
        permanent: true,
      },
      {
        source: "/scanner-chat",
        destination: "/liquid-scan",
        permanent: false,
      },
      {
        source: "/scanner-chat/:path*",
        destination: "/liquid-scan/:path*",
        permanent: false,
      },
      {
        source: "/scanner/chat",
        destination: "/liquid-scan",
        permanent: false,
      },
      {
        source: "/scanner/chat/:path*",
        destination: "/liquid-scan/:path*",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
