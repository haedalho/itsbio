export type KentOfficialSection = {
  _key: string;
  type: string;
  title: string;
  html?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  items?: Array<{
    _key: string;
    title?: string;
    label?: string;
    description?: string;
    url?: string;
    href?: string;
    imageUrl?: string;
  }>;
  rows?: Array<Record<string, string>>;
};

export type KentOfficialProductOverride = {
  title: string;
  summary: string;
  sku: string;
  badge?: string;
  leadHtml?: string;
  fallbackImages?: Array<{ url: string; alt: string }>;
  sections: KentOfficialSection[];
};

const SOMNOFLO_O2CARE: KentOfficialProductOverride = {
  title: "SomnoFlo® O2Care",
  summary: "Blend air and O₂",
  sku: "SF-06",
  badge: "NEW",
  leadHtml:
    "<p>Research protocols may require more oxygen than ambient air provides, while continuous pure oxygen can introduce unwanted experimental effects. SomnoFlo O2Care combines an internal ambient-air pump with a compressed-oxygen connection so the carrier gas can be adjusted without an external mixer or a custom gas blend.</p><p>Use ambient air at 21% oxygen or select 35%, 50%, 70% or 100% oxygen for long procedures, recovery, emergency support and refined anesthesia protocols.</p>",
  fallbackImages: [
    {
      url: "https://www.kentscientific.com/wp-content/uploads/2025/09/SF_01_CONTROLLER_3QTRR_Silo_copy-1.png",
      alt: "SomnoFlo O2Care digital anesthesia system",
    },
  ],
  sections: [
    {
      _key: "somnoflo-o2care-pressure-note",
      type: "notice",
      title: "Oxygen-source requirement",
      description:
        "SomnoFlo O2Care operates with its internal ambient-air pump or an approved compressed-oxygen source. When the connected regulator supplies more than 15 psi, use the compatible SOMNO-7305 preset pressure reducer.",
    },
    {
      _key: "somnoflo-o2care-features",
      type: "features",
      title: "What you get from SomnoFlo O2Care",
      items: [
        {
          _key: "oxygen-control",
          title: "Precise oxygen control",
          description: "Operate with 21% ambient air or select 35%, 50%, 70% and 100% oxygen presets.",
        },
        {
          _key: "low-flow",
          title: "Ultra-low flow rates",
          description: "Electronic flow control supports delivery from 100 to 1,000 mL/min.",
        },
        {
          _key: "maintenance",
          title: "No annual calibration required",
          description: "The electronic vaporizer does not require the annual calibration and certification cycle used by many traditional vaporizers.",
        },
        {
          _key: "wag",
          title: "Minimal waste anesthetic gas exposure",
          description: "Low-flow delivery reduces anesthetic consumption and the volume of waste anesthetic gas produced.",
        },
        {
          _key: "touchscreen",
          title: "Compact touchscreen interface",
          description: "Oxygen presets, alarms, purge control and vaporizer operation are available from one compact controller.",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-feedback",
      type: "reviews",
      title: "What researchers say about SomnoFlo",
      items: [
        {
          _key: "review-vermont",
          title: "University of Vermont",
          description: "Reported extensive surgical use with very low isoflurane consumption and no obvious staff exposure concerns.",
        },
        {
          _key: "review-missouri",
          title: "University of Missouri",
          description: "Reported positive experience using both SomnoSuite and SomnoFlo systems.",
        },
        {
          _key: "review-colorado",
          title: "Colorado State University",
          description: "Reported reliable operation after prompt technical support and recommended replacing older vaporizers that require annual calibration.",
        },
        {
          _key: "review-british-columbia",
          title: "The University of British Columbia",
          description: "Highlighted the small upright footprint, automatic priming and draining, and direct bottle filling.",
        },
        {
          _key: "review-vanderbilt",
          title: "Vanderbilt University",
          description: "Reported heavy use across four units with low anesthetic consumption and minimal charcoal-filter loading over many procedures.",
        },
        {
          _key: "review-artizan",
          title: "Artizan Biosciences",
          description: "Reported a positive experience with the first unit and subsequently ordered another.",
        },
        {
          _key: "review-mgh",
          title: "Massachusetts General Hospital",
          description: "Reported strong performance together with responsive product support.",
        },
        {
          _key: "review-sigilon",
          title: "Sigilon Therapeutics",
          description: "Highlighted the smaller footprint and the convenience of operating with room air instead of continuously managing oxygen cylinders.",
        },
        {
          _key: "review-northwestern",
          title: "Northwestern University",
          description: "Reported efficient operation, fast recovery and positive acceptance among laboratory users.",
        },
        {
          _key: "review-arkansas",
          title: "University of Arkansas",
          description: "Reported reliable use during rodent procedures and positive feedback from the laboratory team.",
        },
        {
          _key: "review-st-josephs",
          title: "St. Joseph’s Hospital",
          description: "Reported that the laboratory team was pleased with the system after purchase.",
        },
        {
          _key: "review-fred-hutch",
          title: "Fred Hutchinson Cancer Research Center",
          description: "Reported that the compact system fits small work areas, is simple to set up and has been recommended to other laboratories.",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-resources",
      type: "documents",
      title: "SomnoFlo resources",
      items: [
        {
          _key: "resource-blended-anesthesia",
          label: "A blended approach to preclinical research anesthesia",
          url: "https://youtu.be/uUt2E1YBGYQ",
        },
        {
          _key: "resource-warming",
          label: "Comparative thermoregulation during rodent anesthesia",
          url: "https://youtu.be/UeAj7W-dDRg",
        },
        {
          _key: "resource-tail-curl",
          label: "Tail-curl reaction in an anesthetized mouse",
          url: "https://youtu.be/2Fb2W-hVTrI",
        },
        {
          _key: "resource-setup",
          label: "SomnoFlo setup and mouse anesthesia protocol",
          url: "https://youtu.be/Jz73f5eQgxM",
        },
        {
          _key: "resource-low-flow",
          label: "Somno low-flow electronic vaporizer overview",
          url: "https://youtu.be/iUlXT-ELog4",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-videos",
      type: "videos",
      title: "Product videos",
      items: [
        {
          _key: "video-setup",
          label: "Setup and mouse anesthesia protocol",
          description: "Kent Scientific product video",
          url: "https://youtu.be/Jz73f5eQgxM",
        },
        {
          _key: "video-tail-curl",
          label: "Tail-curl reaction in an anesthetized mouse",
          description: "Kent Scientific product video",
          url: "https://youtu.be/2Fb2W-hVTrI",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-overview",
      type: "rich-text",
      title: "About SomnoFlo O2Care",
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/08/oxygen.jpg",
      imageAlt: "SomnoFlo O2Care oxygen control",
      html:
        "<h3>Overview</h3><p>SomnoFlo O2Care removes the need to choose between pure oxygen and ambient air. Researchers can adjust oxygen delivery without custom gas blends or a separate mixer, supporting repeatable protocols with a compact low-flow platform.</p><ol><li>Connect an approved oxygen source when supplementation is needed.</li><li>Select the required oxygen level.</li><li>Set anesthetic concentration and flow.</li><li>Begin vaporization and monitor the system from the touchscreen.</li></ol><h3>Smart oxygen control, simplified</h3><p>The internal air pump and compressed-oxygen connection provide flexible carrier-gas control for routine anesthesia, long procedures, recovery and emergency support.</p>",
    },
    {
      _key: "somnoflo-o2care-efficiency",
      type: "rich-text",
      title: "Lower anesthetic and compressed-gas use",
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/08/Operational.png",
      imageAlt: "SomnoFlo O2Care operational efficiency",
      html:
        "<p>Kent compares SomnoFlo O2Care operating at 0.2 L/min with a traditional vaporizer operating at 2 L/min. Lower flow can reduce anesthetic consumption, charcoal-filter loading, waste anesthetic gas and reliance on compressed-gas cylinders.</p><p>The actual reduction depends on annual use, the laboratory protocol and the selected carrier-gas configuration. Supplier pricing and the interactive savings calculator are intentionally not displayed on the ITS BIO catalog.</p>",
    },
    {
      _key: "somnoflo-o2care-specifications",
      type: "spec-table",
      title: "Product specifications",
      rows: [
        { Group: "Flow rate", Specification: "Range", Value: "100–1,000 mL/min" },
        { Group: "Flow rate", Specification: "Manual override", Value: "Yes" },
        { Group: "Flow rate", Specification: "Sensor", Value: "Electronic flow sensor" },
        { Group: "Oxygen", Specification: "Ambient-air mode", Value: "21% oxygen" },
        { Group: "Oxygen", Specification: "Compressed-oxygen presets", Value: "35%, 50%, 70%, 100%" },
        { Group: "Application", Specification: "Multi-animal use", Value: "Yes" },
        { Group: "Application", Specification: "Stereotaxic use", Value: "Yes" },
        { Group: "Operation", Specification: "Carrier-gas sources", Value: "Internal ambient-air pump or approved compressed oxygen" },
        { Group: "Operation", Specification: "Anesthetics", Value: "Isoflurane and sevoflurane" },
        { Group: "Operation", Specification: "Presets", Value: "User-selectable" },
        { Group: "Operation", Specification: "Alarms", Value: "Yes" },
        { Group: "Operation", Specification: "Purge", Value: "Yes" },
        { Group: "Maintenance", Specification: "Annual calibration", Value: "Not required" },
        { Group: "Filling and delivery", Specification: "Method", Value: "Direct from bottle" },
        { Group: "Filling and delivery", Specification: "Capacity", Value: "100 mL and 250 mL" },
        { Group: "Filling and delivery", Specification: "Accuracy", Value: "0.1%" },
        { Group: "Warranty", Specification: "Standard", Value: "1 year included" },
        { Group: "Warranty", Specification: "Premium", Value: "3 years total" },
      ],
    },
    {
      _key: "somnoflo-o2care-warranty",
      type: "warranty",
      title: "Warranty information",
      rows: [
        { Plan: "Standard", Coverage: "1 year", Benefits: "Standard controller warranty" },
        { Plan: "Extended", Coverage: "Additional 2 years", Benefits: "Extended controller coverage; approval or inspection may be required when purchased later" },
        { Plan: "Premium", Coverage: "Additional 2 years", Benefits: "Enhanced loaner, shipping, training and expedited-repair support" },
      ],
    },
    {
      _key: "somnoflo-o2care-warranty-notes",
      type: "notice",
      title: "Warranty notes",
      description:
        "Damage caused by abuse, negligence or misuse is not covered. Expedited repair time begins after the product is received. Customers must identify the warranty claim, and warranty extensions purchased after the original sale may require controller inspection and approval.",
    },
  ],
};

const OFFICIAL_OVERRIDES: Record<string, KentOfficialProductOverride> = {
  "somnoflo-o2care": SOMNOFLO_O2CARE,
};

export function getKentOfficialProductOverride(slug: string) {
  return OFFICIAL_OVERRIDES[String(slug || "").trim().toLowerCase()] || null;
}
