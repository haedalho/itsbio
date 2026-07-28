import OFFICIAL_BATCH_0001 from "./official-batch-0001";
import SOMNOSUITE from "./official-somnosuite";

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

export type KentOfficialOptionGroup = {
  key?: string;
  name?: string;
  label?: string;
  displayType?: string;
  options?: Array<{ value?: string; label?: string }>;
};

export type KentOfficialVariant = {
  variantId?: string;
  title?: string;
  sku?: string;
  catNo?: string;
  optionSummary?: string;
  optionValues?: Record<string, string> | Array<{ key?: string; label?: string; value?: string }>;
  attributes?: Record<string, string> | Array<{ key?: string; label?: string; value?: string }>;
  imageUrl?: string;
  sourceVariationId?: string;
};

export type KentOfficialProductOverride = {
  title: string;
  summary: string;
  sku: string;
  badge?: string;
  leadHtml?: string;
  fallbackImages?: Array<{ url: string; alt: string }>;
  productType?: string;
  defaultVariantId?: string;
  optionGroups?: KentOfficialOptionGroup[];
  variants?: KentOfficialVariant[];
  sections: KentOfficialSection[];
  verification?: {
    status?: string;
    sourceUrl?: string;
    checkedAt?: string;
    notes?: string;
  };
};

const SOMNOFLO_O2CARE: KentOfficialProductOverride = {
  title: "SomnoFlo® O2Care",
  summary: "Blend air and O₂",
  sku: "SF-06",
  badge: "NEW",
  leadHtml:
    "<p>Recent research has suggested that pure oxygen can cause unintended off-target effects during veterinary anesthesia, but 21% oxygen isn’t always enough to prevent hypoxia. Custom gas blends are cumbersome and external gas mixers can be cumbersome, expensive, or difficult to use.</p><p>SomnoFlo® O2Care solves these problems by blending ambient air and 100% compressed oxygen to deliver the ideal anesthetic carrier gas composition for your animals. Now you can get the oxygen supplementation that they need, without any external gas mixers or custom gas blends!</p><p>SomnoFlo O2Care allows you to connect a pure oxygen source and easily adjust the carrier gas composition to 21%, 35%, 50%, 70%, or 100% oxygen. Perfect for long procedures where supplemental O2 is required, for recovery phases, emergencies, or anyone looking to refine their anesthetic protocols.</p><p><strong>(SomnoFlo O2Care operates using an internal air pump with ambient air or with compressed gas. If your regulator exceeds 15psi, the SOMNO-7305 Preset Pressure Reducer is required to regulate the pressure)</strong></p>",
  fallbackImages: [
    {
      url: "https://www.kentscientific.com/wp-content/uploads/2025/09/SF_01_CONTROLLER_3QTRR_Silo_copy-1.png",
      alt: "SomnoFlo O2Care digital anesthesia system",
    },
  ],
  sections: [
    {
      _key: "somnoflo-o2care-related-products",
      type: "related-products",
      title: "Customers who viewed this item also viewed",
      items: [
        {
          _key: "related-warming-pad",
          title: "Far Infrared Warming Pads with Controller for Small Animal Recovery",
          description: "Warming",
          href: "/products/kent/item/far-infrared-warming-pads-with-controller",
        },
        {
          _key: "related-righttemp-jr",
          title: "RightTemp® Jr.",
          description: "Warming",
          href: "/products/kent/item/righttemp-jr",
        },
        {
          _key: "related-physiosuite",
          title: "PhysioSuite®",
          description: "Physiological Monitoring",
          href: "/products/kent/item/physiosuite",
        },
      ],
    },
    {
      _key: "somnoflo-o2care-features",
      type: "features",
      title: "What you get from SomnoFlo O2Care",
      items: [
        { _key: "oxygen-control", title: "Precise oxygen control (21%–100%)" },
        { _key: "low-flow", title: "Ultra-low flow rates (as low as 100 mL/min)" },
        { _key: "maintenance", title: "No annual calibration or certification needed" },
        { _key: "wag", title: "Minimal waste anesthetic gas exposure" },
        { _key: "touchscreen", title: "Compact, easy-to-use touchscreen interface" },
      ],
    },
    {
      _key: "somnoflo-o2care-feedback",
      type: "reviews",
      title: "What your peers say about SomnoFlo",
      items: [
        { _key: "review-vermont", title: "Dr. David Coggin-Carr — University of Vermont", description: "Reported extensive recent surgical use, very low isoflurane consumption and no obvious staff-exposure concerns." },
        { _key: "review-missouri", title: "Sarah Schlink, DVM, DACLAM — University of Missouri", description: "Reported a positive experience using both SomnoSuite and SomnoFlo systems." },
        { _key: "review-colorado", title: "Jason Cummings — Colorado State University", description: "Reported reliable operation after prompt technical support and recommended the system as an alternative to older vaporizers requiring annual calibration." },
        { _key: "review-vanderbilt", title: "Carlo M. Malabanan, Lab Manager — Vanderbilt University", description: "Reported heavy use across four units, low anesthetic consumption and minimal charcoal-filter loading over many procedures." },
        { _key: "review-artizan", title: "Keely Walsh, BS, LATG — Artizan Biosciences", description: "Reported a positive experience with the first unit and subsequently ordered another." },
        { _key: "review-mgh", title: "Kiera Ottino, Research Technician — Massachusetts General Hospital", description: "Reported strong performance together with responsive product support." },
        { _key: "review-sigilon", title: "Lauren Sohn, Scientist — Sigilon Therapeutics", description: "Highlighted the smaller footprint and the convenience of using room air without continuously managing oxygen cylinders." },
        { _key: "review-northwestern", title: "Michael Sande — Northwestern University", description: "Reported efficient operation, fast recovery and strong acceptance among laboratory users." },
        { _key: "review-arkansas", title: "Jarrett Sweeley, Research Compliance — University of Arkansas", description: "Reported reliable use during rodent procedures and positive feedback from the laboratory team." },
        { _key: "review-st-josephs", title: "Pamela Bortz, Sr. Vet Technologist — St. Joseph’s Hospital", description: "Reported that the laboratory team was pleased with the system after purchase." },
        { _key: "review-fred-hutch", title: "Jonathan Linton — Fred Hutchinson Cancer Research Center", description: "Reported that the compact system fits small work areas, is simple to set up and has been recommended to other laboratories." },
        { _key: "review-british-columbia", title: "Dr. Shelly McErlane, DVM — The University of British Columbia", description: "Highlighted the upright footprint, automatic priming and draining, and direct bottle filling." },
      ],
    },
    {
      _key: "somnoflo-o2care-resources",
      type: "documents",
      title: "SomnoFlo resources",
      items: [
        { _key: "resource-blended-anesthesia", label: "Webinar: A Blended Approach to Preclinical Research Anesthesia — Rethinking Room Air vs Pure O₂", url: "https://youtu.be/uUt2E1YBGYQ" },
        { _key: "resource-warming", label: "Warming Up for Success: Comparative Efficacy of Thermoregulatory Devices in Rodent Anesthesia", url: "https://youtu.be/UeAj7W-dDRg" },
        { _key: "resource-tail-curl", label: "Tail Curl Reaction in an Anesthetized Mouse", url: "https://youtu.be/2Fb2W-hVTrI" },
        { _key: "resource-setup", label: "SomnoFlo® Setup and Mouse Anesthesia Protocol", url: "https://youtu.be/Jz73f5eQgxM" },
        { _key: "resource-low-flow", label: "Somno® Low-Flow Electronic Vaporizers: Extremely Precise Anesthesia Delivery", url: "https://youtu.be/iUlXT-ELog4" },
      ],
    },
    {
      _key: "somnoflo-o2care-videos",
      type: "videos",
      title: "Product videos",
      items: [
        { _key: "video-setup", label: "Setup and Mouse Anesthesia Protocol", description: "Kent Scientific product video", url: "https://youtu.be/Jz73f5eQgxM" },
        { _key: "video-tail-curl", label: "Tail Curl Reaction in an Anesthetized Mouse", description: "Kent Scientific product video", url: "https://youtu.be/2Fb2W-hVTrI" },
      ],
    },
    {
      _key: "somnoflo-o2care-overview",
      type: "rich-text",
      title: "About SomnoFlo O2Care",
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/08/oxygen.jpg",
      imageAlt: "SomnoFlo O2Care oxygen control",
      html: "<h3>Overview</h3><p>SomnoFlo O2Care is designed for laboratories that need adjustable oxygen delivery without a custom gas blend or a separate mixer. Its compact low-flow platform lets the user match oxygen delivery to the animal and procedure while maintaining a straightforward setup.</p><ul><li>Connect the system to an approved oxygen source.</li><li>Set the required O₂ level.</li><li>Start precise vaporization.</li><li>Use a repeatable carrier-gas setting for the procedure.</li></ul><h3>Smart oxygen control, simplified</h3><p>The internal air pump and compressed-oxygen connection provide flexible carrier-gas control for routine anesthesia, long procedures, recovery and emergency support.</p>",
    },
    {
      _key: "somnoflo-o2care-efficiency",
      type: "rich-text",
      title: "Lower anesthetic use, bigger cost savings",
      imageUrl: "https://www.kentscientific.com/wp-content/uploads/2025/08/Operational.png",
      imageAlt: "SomnoFlo O2Care operational efficiency",
      html: "<h3>Estimated yearly operational savings</h3><p>Kent compares SomnoFlo O2Care operating at 0.2 L/min with a traditional vaporizer operating at 2 L/min. At the same 2% anesthetic concentration, the lower flow can reduce anesthetic consumption, charcoal-filter loading, waste anesthetic gas and compressed-gas use.</p><h3>Calculation basis</h3><ul><li>SomnoFlo O2Care flow rate: 0.2 L/min.</li><li>Traditional vaporizer comparison flow rate: 2 L/min.</li><li>Comparison anesthetic concentration: 2%.</li><li>Actual results depend on annual use, local protocols and carrier-gas configuration.</li></ul>",
    },
    {
      _key: "somnoflo-o2care-specifications",
      type: "spec-table",
      title: "Product specifications",
      rows: [
        { Group: "Flow rate", Specification: "Flow rate", Value: "100–1,000 mL/min" },
        { Group: "Flow rate", Specification: "Manual override", Value: "Yes" },
        { Group: "Flow rate", Specification: "Sensor", Value: "Electronic flow sensor" },
        { Group: "Flow rate", Specification: "Oxygen presets", Value: "35%, 50%, 70%, 100%" },
        { Group: "Application", Specification: "Multi-animal", Value: "Yes" },
        { Group: "Application", Specification: "Stereotaxic", Value: "Yes" },
        { Group: "Warranty", Specification: "Standard (included)", Value: "1 year" },
        { Group: "Warranty", Specification: "Premium (optional)", Value: "3 years" },
        { Group: "Operation", Specification: "Modes", Value: "Compressed gas" },
        { Group: "Operation", Specification: "Anesthetic", Value: "Isoflurane and sevoflurane" },
        { Group: "Operation", Specification: "Presets", Value: "User-selectable" },
        { Group: "Operation", Specification: "Alarms", Value: "Yes" },
        { Group: "Operation", Specification: "Purge", Value: "Yes" },
        { Group: "Operation", Specification: "Maintenance", Value: "No annual calibration" },
        { Group: "Filling and delivery", Specification: "Method", Value: "Direct from bottle" },
        { Group: "Filling and delivery", Specification: "Capacity", Value: "100 mL and 250 mL" },
        { Group: "Filling and delivery", Specification: "Accuracy", Value: "0.1%" },
      ],
    },
    {
      _key: "somnoflo-o2care-warranty",
      type: "warranty",
      title: "Warranty information",
      rows: [
        { Plan: "Standard", Coverage: "1 year", Benefits: "Standard controller coverage" },
        { Plan: "Extended", Coverage: "Additional 2 years", Benefits: "Extended controller coverage; later purchase may require approval or inspection" },
        { Plan: "Premium", Coverage: "Additional 2 years", Benefits: "Enhanced loaner, shipping, training and expedited-repair support" },
      ],
    },
    {
      _key: "somnoflo-o2care-warranty-notes",
      type: "notice",
      title: "Warranty notes",
      description: "Damage resulting from abuse, negligence or misuse is not covered. Expedited repair timing begins after the product is received. Customers must identify the warranty claim, and an extension purchased after the original sale may require controller inspection and approval.",
    },
  ],
};

const OFFICIAL_OVERRIDES: Record<string, KentOfficialProductOverride> = {
  ...OFFICIAL_BATCH_0001,
  "somnoflo-o2care": SOMNOFLO_O2CARE,
  somnosuite: SOMNOSUITE,
};

export function getKentOfficialProductOverride(slug: string) {
  return OFFICIAL_OVERRIDES[String(slug || "").trim().toLowerCase()] || null;
}
