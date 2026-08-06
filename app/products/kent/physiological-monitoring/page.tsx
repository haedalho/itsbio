import KentCuratedCategoryPage from "@/components/products/KentCuratedCategoryPage";

export const revalidate = 300;

export default function PhysiologicalMonitoringPage() {
  return (
    <KentCuratedCategoryPage
      title="Physiological Monitoring"
      rootPath={["physiological-monitoring"]}
      intro="Kent Scientific physiological monitoring systems help researchers monitor temperature, pulse oximetry, heart rate, end-tidal CO₂, and related vital parameters during research and surgery."
      productSections={[
        {
          title: "Physiological monitoring systems",
          description:
            "The primary systems currently featured on Kent Scientific's Physiological Monitoring page.",
          slugs: ["anipill", "physiosuite"],
        },
      ]}
      relatedTitle="Additional physiological monitoring equipment"
      relatedCategories={[
        {
          title: "Temperature",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories/temperature",
          count: 6,
          representativeSlug: "righttemp",
        },
        {
          title: "Pulse Oximetry",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories/pulse-oximetry",
          count: 1,
          representativeSlug: "mousestat-jr",
        },
        {
          title: "Physiological Monitoring Accessories",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories",
          count: 16,
          representativeSlug: "mouse-paw-pulse-oximeter-sensors",
        },
        {
          title: "Anesthesia Accessories for SomnoSuite®",
          href: "/products/kent/anesthesia/anesthesia-accessories/anesthesia-accessories-for-somnosuite",
          count: 13,
          representativeSlug: "low-cost-chambers-for-somnosuite",
        },
        {
          title: "Anesthesia Accessories for SomnoFlo®",
          href: "/products/kent/anesthesia/anesthesia-accessories/anesthesia-accessories-for-somnoflo",
          count: 15,
          representativeSlug: "3-accessory-connector",
        },
        {
          title: "Accessories for CODA® Monitor",
          href: "/products/kent/noninvasive-blood-pressure/noninvasive-blood-pressure-accessories/accessories-for-coda-monitor",
          count: 10,
          representativeSlug: "coda-monitor-cuff-kits",
        },
      ]}
      sidebarChildren={[
        {
          title: "Physiological Monitoring Accessories",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories",
        },
        {
          title: "Pulse Oximetry",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories/pulse-oximetry",
        },
        {
          title: "Temperature",
          href: "/products/kent/physiological-monitoring/physiological-monitoring-accessories/temperature",
        },
      ]}
    />
  );
}
