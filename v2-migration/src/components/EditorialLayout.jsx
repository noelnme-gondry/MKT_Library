import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";

export default function EditorialLayout({ children, locale = "ko" }) {
  return <>
    <div className="app"><Sidebar locale={locale} /><div className="main"><Header locale={locale} />{children}</div></div>
    <GlobalModals locale={locale} />
  </>;
}
