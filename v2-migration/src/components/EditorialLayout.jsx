import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import SourceSurveyPopup from "@/components/assistant/SourceSurveyPopup";

export default function EditorialLayout({ children, locale = "ko" }) {
  return <>
    <div className="app"><Sidebar locale={locale} /><div className="main"><Header locale={locale} />{children}<SourceSurveyPopup locale={locale} /></div></div>
    <GlobalModals locale={locale} />
  </>;
}
