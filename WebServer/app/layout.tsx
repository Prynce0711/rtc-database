import type { Metadata } from "next";
import { PublicEnvScript } from "next-runtime-env";
import { Montserrat } from "next/font/google";
import PopupProvider from "./components/Popup/PopupProvider";
import { isDarkModeEnabled } from "./components/Sidebar/DarkModeActions";
import "./globals.css";
import SocketProvider from "./lib/socket/SocketProvider";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Regional Trial Court",
  description: "Regional Trial Court management system",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const result = await isDarkModeEnabled();

  const darkModeClass = result.success && result.result ? "dim" : "winter";

  return (
    <html lang="en" data-theme={darkModeClass}>
      <head>
        <PublicEnvScript />
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <PopupProvider>
          <SocketProvider>{children}</SocketProvider>
        </PopupProvider>
      </body>
    </html>
  );
}
