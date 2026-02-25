// vite.config.ts
import tailwindcss from "file:///C:/Users/JC%20Rosuelo/rtc-database/node_modules/.pnpm/@tailwindcss+vite@4.1.18_vi_3d257a50aecff5d143e91b0913673cfc/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///C:/Users/JC%20Rosuelo/rtc-database/node_modules/.pnpm/@vitejs+plugin-react@4.7.0__a1ba5f5141390b0ed70c004e77815d06/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "node:path";
import { defineConfig } from "file:///C:/Users/JC%20Rosuelo/rtc-database/node_modules/.pnpm/vite@5.4.21_@types+node@25.2.0_lightningcss@1.30.2/node_modules/vite/dist/node/index.js";
import electron from "file:///C:/Users/JC%20Rosuelo/rtc-database/node_modules/.pnpm/vite-plugin-electron@0.28.8_6e9e5393ea9c4ccc34d07117698adaaa/node_modules/vite-plugin-electron/dist/simple.mjs";
var __vite_injected_original_dirname = "C:\\Users\\JC Rosuelo\\rtc-database\\NativeApp";
var vite_config_default = defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: "electron/main.ts"
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__vite_injected_original_dirname, "electron/preload.ts")
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === "test" ? (
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        void 0
      ) : {}
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxKQyBSb3N1ZWxvXFxcXHJ0Yy1kYXRhYmFzZVxcXFxOYXRpdmVBcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEpDIFJvc3VlbG9cXFxccnRjLWRhdGFiYXNlXFxcXE5hdGl2ZUFwcFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvSkMlMjBSb3N1ZWxvL3J0Yy1kYXRhYmFzZS9OYXRpdmVBcHAvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgZWxlY3Ryb24gZnJvbSBcInZpdGUtcGx1Z2luLWVsZWN0cm9uL3NpbXBsZVwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICB0YWlsd2luZGNzcygpLFxyXG4gICAgcmVhY3QoKSxcclxuICAgIGVsZWN0cm9uKHtcclxuICAgICAgbWFpbjoge1xyXG4gICAgICAgIC8vIFNob3J0Y3V0IG9mIGBidWlsZC5saWIuZW50cnlgLlxyXG4gICAgICAgIGVudHJ5OiBcImVsZWN0cm9uL21haW4udHNcIixcclxuICAgICAgfSxcclxuICAgICAgcHJlbG9hZDoge1xyXG4gICAgICAgIC8vIFNob3J0Y3V0IG9mIGBidWlsZC5yb2xsdXBPcHRpb25zLmlucHV0YC5cclxuICAgICAgICAvLyBQcmVsb2FkIHNjcmlwdHMgbWF5IGNvbnRhaW4gV2ViIGFzc2V0cywgc28gdXNlIHRoZSBgYnVpbGQucm9sbHVwT3B0aW9ucy5pbnB1dGAgaW5zdGVhZCBgYnVpbGQubGliLmVudHJ5YC5cclxuICAgICAgICBpbnB1dDogcGF0aC5qb2luKF9fZGlybmFtZSwgXCJlbGVjdHJvbi9wcmVsb2FkLnRzXCIpLFxyXG4gICAgICB9LFxyXG4gICAgICAvLyBQbG95ZmlsbCB0aGUgRWxlY3Ryb24gYW5kIE5vZGUuanMgQVBJIGZvciBSZW5kZXJlciBwcm9jZXNzLlxyXG4gICAgICAvLyBJZiB5b3Ugd2FudCB1c2UgTm9kZS5qcyBpbiBSZW5kZXJlciBwcm9jZXNzLCB0aGUgYG5vZGVJbnRlZ3JhdGlvbmAgbmVlZHMgdG8gYmUgZW5hYmxlZCBpbiB0aGUgTWFpbiBwcm9jZXNzLlxyXG4gICAgICAvLyBTZWUgXHVEODNEXHVEQzQ5IGh0dHBzOi8vZ2l0aHViLmNvbS9lbGVjdHJvbi12aXRlL3ZpdGUtcGx1Z2luLWVsZWN0cm9uLXJlbmRlcmVyXHJcbiAgICAgIHJlbmRlcmVyOlxyXG4gICAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcInRlc3RcIlxyXG4gICAgICAgICAgPyAvLyBodHRwczovL2dpdGh1Yi5jb20vZWxlY3Ryb24tdml0ZS92aXRlLXBsdWdpbi1lbGVjdHJvbi1yZW5kZXJlci9pc3N1ZXMvNzgjaXNzdWVjb21tZW50LTIwNTM2MDA4MDhcclxuICAgICAgICAgICAgdW5kZWZpbmVkXHJcbiAgICAgICAgICA6IHt9LFxyXG4gICAgfSksXHJcbiAgXSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFQsT0FBTyxpQkFBaUI7QUFDcFYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLGNBQWM7QUFKckIsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsWUFBWTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBO0FBQUEsUUFFSixPQUFPO0FBQUEsTUFDVDtBQUFBLE1BQ0EsU0FBUztBQUFBO0FBQUE7QUFBQSxRQUdQLE9BQU8sS0FBSyxLQUFLLGtDQUFXLHFCQUFxQjtBQUFBLE1BQ25EO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFJQSxVQUNFLFFBQVEsSUFBSSxhQUFhO0FBQUE7QUFBQSxRQUVyQjtBQUFBLFVBQ0EsQ0FBQztBQUFBLElBQ1QsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
