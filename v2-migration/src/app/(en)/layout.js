import "../globals.css";
import RootDocument from "@/components/RootDocument";
import { buildRootMetadata } from "@/lib/siteMetadata";

export const metadata = buildRootMetadata("en");

export default function EnglishRootLayout({ children }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
