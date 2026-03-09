// studio-admin/schemaTypes/index.ts
import brand from "./brand";
import category from "./category";
import product from "./product";
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

// ✅ 추가
import contentBlockCards from "./contentBlocks/contentBlockCards";

export const schemaTypes = [
  brand,
  category,
  product,
  notice,
  promotion,

  contentBlockHtml,
  contentBlockRichText,
  contentBlockLinks,
  contentBlockBullets,
  contentBlockResources,
  contentBlockPublications,
  contentBlockCta,

  // ✅ 추가
  contentBlockCards,
];
