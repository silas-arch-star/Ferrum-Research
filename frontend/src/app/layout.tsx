import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./existing-typefaces.css";
import "./globals.css";
import "./liquid-editorial.css";
import "./cinematic-entrance.css";
import "./optical-glass.css";
import "./desktop-product.css";
import "./desktop-motion.css";
import "./evidence-charts.css";
import "./intelligence-workbench.css";
import "./dropdowns.css";
import "./mobile-product.css";
import CinematicEntrance from "./cinematic-entrance";
import MotionNavigation from "./motion-navigation";
import { ChartPointTooltip } from "./chart-tooltip";

const manrope = localFont({ src: "./fonts/manrope-variable.ttf", variable: "--font-manrope", weight: "200 800", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "Ferrum — Metals & Mining Research",
  description: "Source-led investment research across India's metals and mining companies.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <head><script id="ferrum-entrance-boot" dangerouslySetInnerHTML={{ __html: `try{var e=location.pathname==='/'&&!location.hash&&sessionStorage.getItem('ferrum:entrance:seen:v1')!=='1';document.documentElement.dataset.entranceState=e?'active':'complete';if(!e)sessionStorage.setItem('ferrum:entrance:seen:v1','1')}catch(e){document.documentElement.dataset.entranceState=location.pathname==='/'?'active':'complete'}` }} /></head>
      <body><CinematicEntrance /><MotionNavigation /><ChartPointTooltip />{children}</body>
    </html>
  );
}
