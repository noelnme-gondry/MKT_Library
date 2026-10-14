import EditorialLayout from "@/components/EditorialLayout";
export default function Layout({ children }) {
  return <EditorialLayout locale="en"><main id="main-content">{children}</main></EditorialLayout>;
}
