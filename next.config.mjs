/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/whistle-search",
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
