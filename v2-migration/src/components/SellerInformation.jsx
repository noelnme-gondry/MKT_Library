import { SELLER } from "@/lib/sellerFacts";

export default function SellerInformation({ locale = "ko" }) {
  const en = locale === "en";
  return <section className="seller-information" aria-label={en ? "Seller information" : "사업자 정보"}>
    <strong>{SELLER.name}</strong>
    <dl>
      <div><dt>{en ? "Representative" : "대표자"}</dt><dd>{SELLER.representative}</dd></div>
      <div><dt>{en ? "Business registration number" : "사업자등록번호"}</dt><dd>{SELLER.registrationNumber}</dd></div>
      <div><dt>{en ? "Business address" : "사업장 주소"}</dt><dd>{SELLER.address}</dd></div>
      <div><dt>{en ? "Customer service" : "고객센터"}</dt><dd><a href={`tel:${SELLER.phone}`}>{SELLER.phone}</a></dd></div>
      <div><dt>{en ? "Email" : "이메일"}</dt><dd><a href={`mailto:${SELLER.email}`}>{SELLER.email}</a></dd></div>
    </dl>
  </section>;
}
