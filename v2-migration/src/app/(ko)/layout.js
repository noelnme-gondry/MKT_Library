import "../globals.css";
import "../library-workspace.css";
import RootDocument from "@/components/RootDocument";
import { buildRootMetadata } from "@/lib/siteMetadata";

export const metadata = buildRootMetadata("ko");

export default function KoreanRootLayout({ children }) {
  return <RootDocument locale="ko">{children}</RootDocument>;
}
