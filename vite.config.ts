import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Nidpo/' // IMPORTANT: Replace 'your-repo-name' with your GitHub repository name
})
