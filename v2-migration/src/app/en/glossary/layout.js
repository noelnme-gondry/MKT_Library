import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function EnGlossaryLayout({ children }) {
  return <>
    <div className="app">
      <Sidebar locale="en" />
      <main className="main" id="main-content"><Header locale="en" />{children}</main>
    </div>
    <GlobalModals locale="en" />
  </>;
}
