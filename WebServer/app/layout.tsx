import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import PopupProvider from "./components/Popup/PopupProvider";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Regional Trial Court",
  description: "Regional Trial Court management system",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="winter">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <PopupProvider>{children}</PopupProvider>
      </body>
    </html>
  );
}
