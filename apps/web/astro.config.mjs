import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
  integrations: [tailwind()],
  vite: {
    optimizeDeps: {
      include: ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/functions-js', 'tslib']
    }
  }
});