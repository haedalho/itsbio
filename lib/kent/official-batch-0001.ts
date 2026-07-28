const OFFICIAL_BATCH_0001 = {
  "somnosuite-y-adapter": {
    title: "2-Accessory Connector For the SomnoFlo® and SomnoSuite® Anesthesia Systems",
    summary: "",
    sku: "10-4500-09",
    leadHtml:
      '<p>The 2-Accessory Connector allows you to direct anesthetic output to 2 animals or two devices (e.g., nose cone and induction chamber). Total tubing length for SomnoSuite is 18&quot;. Total tubing length for SomnoFlo is 26&quot;.</p>',
    fallbackImages: [
      {
        url: "https://www.kentscientific.com/Customer-Content/www/products/Photos/Full/SOMNO-0602_10-4500_4_5.jpg",
        alt: "Y Adapter",
      },
      {
        url: "https://www.kentscientific.com/Customer-Content/www/products/Photos/Thumb/SomnoSuiteTypSetup.jpg",
        alt: "SomnoSuite Setup with Y Adapter",
      },
    ],
    productType: "variant",
    defaultVariantId: "10-4500-09",
    optionGroups: [
      {
        key: "configuration",
        name: "Configuration",
        label: "Select system compatibility",
        displayType: "select",
        options: [
          {
            value: "somnoflo-systems",
            label: "2-Accessory Connector for SomnoFlo systems",
          },
          {
            value: "somnosuite-serial-b",
            label: '2-Accessory Connector for all new and existing SomnoSuite systems with serial #s ending in "-B"',
          },
          {
            value: "somnosuite-legacy",
            label: '2-Accessory Connector for all existing SomnoSuite systems with serial #s that do not end in "-B"',
          },
        ],
      },
    ],
    variants: [
      {
        variantId: "10-8000-23",
        title: "2-Accessory Connector for SomnoFlo systems",
        sku: "10-8000-23",
        catNo: "10-8000-23",
        optionSummary: "For SomnoFlo systems",
        optionValues: { configuration: "somnoflo-systems" },
      },
      {
        variantId: "10-4500-09",
        title: '2-Accessory Connector for all new and existing SomnoSuite systems with serial #s ending in "-B"',
        sku: "10-4500-09",
        catNo: "10-4500-09",
        optionSummary: 'For all new and existing SomnoSuite systems with serial #s ending in "-B"',
        optionValues: { configuration: "somnosuite-serial-b" },
      },
      {
        variantId: "SOMNO-0602",
        title: '2-Accessory Connector for all existing SomnoSuite systems with serial #s that do not end in "-B"',
        sku: "SOMNO-0602",
        catNo: "SOMNO-0602",
        optionSummary: 'For all existing SomnoSuite systems with serial #s that do not end in "-B"',
        optionValues: { configuration: "somnosuite-legacy" },
      },
    ],
    sections: [
      {
        _key: "somnosuite-y-adapter-related-products",
        type: "related-products",
        title: "Related Products",
        items: [
          {
            _key: "related-somnosuite",
            title: "SomnoSuite®",
            href: "/products/kent/item/somnosuite",
          },
          {
            _key: "related-somnoflo",
            title: "SomnoFlo®",
            href: "/products/kent/item/somnoflo",
          },
        ],
      },
    ],
    verification: {
      status: "STAGING",
      sourceUrl: "https://www.kentscientific.com/products/somnosuite-y-adapter/",
      checkedAt: "2026-07-28",
      notes: "Official title, description, two gallery subjects, three configurations and related products captured. Price, quantity, cart, supplier support and empty review form excluded.",
    },
  },
};

export default OFFICIAL_BATCH_0001;
