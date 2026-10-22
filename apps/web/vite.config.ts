import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Same variable the API listens on, so the two can't drift apart.
const apiPort = process.env.API_PORT || "4000"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
    },
  },
})
