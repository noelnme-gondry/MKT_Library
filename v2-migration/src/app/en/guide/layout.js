// EN 가이드 라우트(/en/guide/*) 공용 셸 — /en/blog·/en과 동일 패턴(Sidebar 없는 슬림 헤더).
// 현재는 1-1(dev-collaboration) 파일럿 1개뿐이지만, 이후 EN 가이드가 늘어도 이 레이아웃을
// 공유하도록 /en/guide 세그먼트에 배치.
import EnLandingHeader from "@/components/EnLandingHeader";

export default function EnGuideLayout({ children }) {
  return (
    <>
      <EnLandingHeader />
      <main className="main">{children}</main>
    </>
  );
}
