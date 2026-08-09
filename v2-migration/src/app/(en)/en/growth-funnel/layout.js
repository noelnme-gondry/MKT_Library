import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function GrowthFunnelLayout({ children }) {
  return <>
    <div className="app">
      <Sidebar locale="en" />
      <div className="main"><Header locale="en" /><main id="main-content" tabIndex="-1">{children}</main></div>
    </div>
    <GlobalModals locale="en" />
  </>;
}
