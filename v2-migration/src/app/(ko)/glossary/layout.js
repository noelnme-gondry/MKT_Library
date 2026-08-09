import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function GlossaryLayout({ children }) {
  return <>
    <div className="app">
      <Sidebar />
      <div className="main"><Header /><main id="main-content" tabIndex="-1">{children}</main></div>
    </div>
    <GlobalModals />
  </>;
}
