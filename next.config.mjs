/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static: there is no server left to run. The output in `out/` is what
  // Cloudflare Pages serves, alongside the single locale-redirect function.
  output: 'export',

  // next/image's default loader needs a server-side optimizer, which a static
  // export does not have.
  images: { unoptimized: true },

  // Emit /en/index.html rather than /en.html so Pages serves the routes cleanly.
  trailingSlash: true,
};

export default nextConfig;
