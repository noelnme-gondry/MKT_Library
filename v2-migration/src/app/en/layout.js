import DocumentLanguage from "@/components/DocumentLanguage";

// RootLayout owns the single <html> element. This nested locale layout keeps
// the live document language accurate during both direct and soft navigation.
export default function EnLocaleLayout({ children }) {
  return (
    <>
      {/* Direct navigation: set the document language before English content is
          parsed; the server-rendered subtree keeps the correct language even
          when JavaScript is disabled. DocumentLanguage covers soft navigation. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.lang='en'" }} />
      <DocumentLanguage lang="en" />
      <div lang="en" data-locale-root="en">{children}</div>
    </>
  );
}
