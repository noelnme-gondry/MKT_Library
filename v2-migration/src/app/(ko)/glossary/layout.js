import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function GlossaryLayout({ children }) {
  return <>
    <div className="app">
      <Sidebar />
      <main className="main" id="main-content"><Header />{children}</main>
    </div>
    <GlobalModals />
  </>;
}
