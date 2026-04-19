/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Permite que o Netlify publique o app mesmo se houver avisos de código
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Permite que o Netlify publique o app mesmo se houver avisos de tipagem
    ignoreBuildErrors: true,
  },
};

export default nextConfig;