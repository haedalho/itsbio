import KentCuratedCategoryPage from "@/components/products/KentCuratedCategoryPage";

export const revalidate = 300;

export default function VentilationPage() {
  return (
    <KentCuratedCategoryPage
      title="Ventilation"
      rootPath={["ventilation"]}
      intro="Kent Scientific ventilation systems support pressure- and volume-controlled ventilation for mice, rats, and other small animals, with intubation equipment for complete respiratory workflows."
      productSections={[
        {
          title: "Ventilation machines",
          description:
            "Core Kent Scientific systems for automatic and modular small-animal ventilation.",
          slugs: ["somnosuite", "rovent", "rovent-jr"],
        },
        {
          title: "Additional ventilation equipment",
          description:
            "Intubation and connection equipment shown on Kent Scientific's current Ventilation page.",
          slugs: [
            "3-accessory-connector",
            "anesthesia-mask-tubing-kits-for-intubation",
            "endotracheal-intubation-kits",
            "endotracheal-tubes",
            "fiber-optic-lighting-assembly",
            "fiber-optic-lighting-kits",
            "intubation-stands",
          ],
        },
      ]}
      relatedTitle="Additional ventilation categories"
      relatedCategories={[
        {
          title: "Intubation",
          href: "/products/kent/ventilation/intubation",
          count: 6,
          representativeSlug: "endotracheal-intubation-kits",
        },
      ]}
      sidebarChildren={[
        {
          title: "Intubation",
          href: "/products/kent/ventilation/intubation",
        },
      ]}
    />
  );
}
