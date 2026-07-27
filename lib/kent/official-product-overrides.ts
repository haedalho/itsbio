export type KentOfficialSection = {
  _key: string;
  type: string;
  title: string;
  html?: string;
  description?: string;
  items?: Array<{
    _key: string;
    title?: string;
    label?: string;
    description?: string;
    url?: string;
  }>;
  rows?: Array<Record<string, string>>;
};

export type KentOfficialProductOverride = {
  title: string;
  summary: string;
  sku: string;
  images: Array<{ url: string; alt: string }>;
  sections: KentOfficialSection[];
};

const SOMNOFLO_O2CARE: KentOfficialProductOverride = {
  title: "SomnoFlo® O2Care",
  summary:
    "A low-flow digital anesthesia system that blends ambient air with compressed oxygen and lets researchers select the oxygen level required for each procedure.",
  sku: "SF-06",
  images: [
    {
      url: "https://www.kentscientific.com/wp-content/uploads/2025/09/SF_01_CONTROLLER_3QTRR_Silo_copy-1.png",
      alt: "SomnoFlo O2Care digital vaporizer",
    },
  ],
  sections: [
    {
      _key: "somnoflo-o2care-features",
      type: "features",
      title: "What you get with SomnoFlo O2Care",
      items: [
        {
          _key: "oxygen-control",
          title: "Selectable oxygen enrichment",
          description: "Choose a carrier-gas oxygen level suited to the animal and procedure, from ambient-air operation through full oxygen delivery.",
        },
        {
          _key: "low-flow",
          title: "Ultra-low flow delivery",
          description: "Electronic flow control supports delivery from 100 to 1,000 mL/min.",
        },
        {
          _key: "maintenance",
          title: "No annual calibration requirement",
          description: "The electronic vaporizer is designed without the annual calibration cycle required by many conventional vaporizers.",
        },
        {
          _key: "wag",
          title: "Lower waste-gas exposure",
          description: "Low-flow operation reduces anesthetic consumption and the volume of waste anesthetic gas produced.",
        },
        {
          _key: "touchscreen",
          title: "Compact touchscreen controller",
          description: "A compact interface provides oxygen presets, alarms, purge control and direct vaporizer operation.",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-feedback",
      type: "reviews",
      title: "Researcher feedback",
      items: [
        {
          _key: "feedback-vermont",
          title: "University of Vermont",
          description: "Reported extensive surgical use with low isoflurane consumption and no obvious staff exposure concerns.",
        },
        {
          _key: "feedback-vanderbilt",
          title: "Vanderbilt University",
          description: "Reported efficient operation across multiple units and very low anesthetic and charcoal-filter consumption over many procedures.",
        },
        {
          _key: "feedback-northwestern",
          title: "Northwestern University",
          description: "Reported reliable operation, rapid recovery and strong acceptance among laboratory users.",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-videos",
      type: "videos",
      title: "Videos and training resources",
      items: [
        {
          _key: "video-blended-approach",
          label: "Blended anesthesia approach: room air and oxygen",
          url: "https://youtu.be/uUt2E1YBGYQ",
        },
        {
          _key: "video-warming",
          label: "Thermoregulatory devices during rodent anesthesia",
          url: "https://youtu.be/UeAj7W-dDRg",
        },
        {
          _key: "video-tail-curl",
          label: "Tail-curl reaction in an anesthetized mouse",
          url: "https://youtu.be/2Fb2W-hVTrI",
        },
        {
          _key: "video-setup",
          label: "SomnoFlo setup and mouse anesthesia protocol",
          url: "https://www.youtube.com/watch?v=Jz73f5eQgxM",
        },
        {
          _key: "video-low-flow",
          label: "Low-flow electronic vaporizer overview",
          url: "https://youtu.be/iUlXT-ELog4",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-overview",
      type: "rich-text",
      title: "About SomnoFlo O2Care",
      html:
        "<p>SomnoFlo O2Care combines an internal ambient-air pump with a compressed-oxygen input so the carrier gas can be adjusted without a separate external gas mixer. It is intended for procedures that require controlled oxygen supplementation while retaining low-flow digital vaporization.</p><ul><li>Connect an approved oxygen source.</li><li>Select the required oxygen setting.</li><li>Set the anesthetic concentration and flow.</li><li>Use alarms and purge controls from the touchscreen interface.</li></ul>",
    },
    {
      _key: "somnoflo-o2care-specifications",
      type: "spec-table",
      title: "Product specifications",
      rows: [
        { Group: "Flow", Specification: "Flow range", Value: "100–1,000 mL/min" },
        { Group: "Flow", Specification: "Manual override", Value: "Yes" },
        { Group: "Flow", Specification: "Sensor", Value: "Electronic flow sensor" },
        { Group: "Oxygen", Specification: "Presets", Value: "35%, 50%, 70%, 100%" },
        { Group: "Application", Specification: "Multi-animal use", Value: "Yes" },
        { Group: "Application", Specification: "Stereotaxic use", Value: "Yes" },
        { Group: "Operation", Specification: "Gas mode", Value: "Compressed gas with ambient-air blending" },
        { Group: "Operation", Specification: "Anesthetics", Value: "Isoflurane and sevoflurane" },
        { Group: "Operation", Specification: "Alarms", Value: "Yes" },
        { Group: "Operation", Specification: "Purge", Value: "Yes" },
        { Group: "Maintenance", Specification: "Annual calibration", Value: "Not required" },
        { Group: "Filling", Specification: "Method", Value: "Direct from bottle" },
        { Group: "Filling", Specification: "Bottle capacity", Value: "100 mL or 250 mL" },
        { Group: "Delivery", Specification: "Concentration accuracy", Value: "0.1%" },
      ],
    },
    {
      _key: "somnoflo-o2care-warranty",
      type: "warranty",
      title: "Warranty information",
      rows: [
        { Plan: "Standard", Coverage: "1 year", Notes: "Included with the system" },
        { Plan: "Extended", Coverage: "Additional 2 years", Notes: "Optional; eligibility may require inspection" },
        { Plan: "Premium", Coverage: "Additional 2 years", Notes: "Includes enhanced loaner, shipping, training and expedited-repair benefits" },
      ],
    },
    {
      _key: "somnoflo-o2care-pressure-note",
      type: "notice",
      title: "Oxygen-source requirement",
      description:
        "When the connected regulator supplies more than 15 psi, use the compatible preset pressure reducer before operating the system.",
    },
  ],
};

const OFFICIAL_OVERRIDES: Record<string, KentOfficialProductOverride> = {
  "somnoflo-o2care": SOMNOFLO_O2CARE,
};

export function getKentOfficialProductOverride(slug: string) {
  return OFFICIAL_OVERRIDES[String(slug || "").trim().toLowerCase()] || null;
}
