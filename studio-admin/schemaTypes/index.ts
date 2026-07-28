// studio-admin/schemaTypes/index.ts
import brand from "./brand";
import category from "./category";
import product from "./product";
import kentOfficialGalleryFields from "./kentOfficialGalleryFields";
import notice from "./notice";
import promotion from "./promotion";

// contentBlocks
import contentBlockHtml from "./contentBlocks/contentBlockHtml";
import contentBlockRichText from "./contentBlocks/contentBlockRichText";
import contentBlockLinks from "./contentBlocks/contentBlockLinks";
import contentBlockBullets from "./contentBlocks/contentBlockBullets";
import contentBlockResources from "./contentBlocks/contentBlockResources";
import contentBlockPublications from "./contentBlocks/contentBlockPublications";
import contentBlockCta from "./contentBlocks/contentBlockCta";
import contentBlockCards from "./contentBlocks/contentBlockCards";

const productWithKentOfficialGallery = {
  ...(product as any),
  fields: [...(((product as any).fields || []) as any[]), ...kentOfficialGalleryFields],
};

export const schemaTypes = [
  brand,
  category,
  productWithKentOfficialGallery,
  notice,
  promotion,

  contentBlockHtml,
  contentBlockRichText,
  contentBlockLinks,
  contentBlockBullets,
  contentBlockResources,
  contentBlockPublications,
  contentBlockCta,
  contentBlockCards,
];
