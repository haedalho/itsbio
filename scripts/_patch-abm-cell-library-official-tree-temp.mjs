#!/usr/bin/env node
import fs from 'node:fs';

const file='app/products/abm/[[...path]]/page.tsx';
let s=fs.readFileSync(file,'utf8');

const helperAnchor=`function canonicalizeCellularCategory<T extends { path?: string[] }>(category: T): T {\n  if (!Array.isArray(category?.path) || category.path[0]?.toLowerCase() !== "cellular-materials") return category;\n  return { ...category, path: canonicalizeCellularPath(category.path) };\n}\n`;

const helper=`function canonicalizeCellularCategory<T extends { path?: string[] }>(category: T): T {\n  if (!Array.isArray(category?.path) || category.path[0]?.toLowerCase() !== "cellular-materials") return category;\n  return { ...category, path: canonicalizeCellularPath(category.path) };\n}\n\nconst OFFICIAL_CELL_LIBRARY_CHILDREN = [\n  ["immortalized-cell-lines", "Immortalized Cell Lines"],\n  ["crispr-ko-cell-lines", "CRISPR KO Cell Lines"],\n  ["cas9-expressing-cell-lines", "Cas9 Expressing Cell Lines"],\n  ["stem-cell-derived-cells", "Stem Cell-Derived Cells"],\n  ["stable-cell-lines", "Stable Cell Lines"],\n  ["tumor-cell-lines", "Tumor Cell Lines"],\n  ["primary-cells", "Primary Cells"],\n] as const;\n\nfunction normalizeOfficialCellularTree(tree: TreeNode[]) {\n  if (!Array.isArray(tree) || !tree.length) return tree;\n\n  const rootItems = [...tree];\n  const cellLibraryIndex = rootItems.findIndex((node) => node.path.at(-1) === "cell-library-collections");\n  if (cellLibraryIndex < 0) return rootItems;\n\n  const cellLibrary = rootItems[cellLibraryIndex];\n  const currentChildren = Array.isArray(cellLibrary.children) ? cellLibrary.children : [];\n  const byLeaf = new Map(currentChildren.map((node) => [node.path.at(-1) || "", node]));\n\n  const special =\n    byLeaf.get("special-cell-line-collection") ||\n    byLeaf.get("special-cell-line-collections") ||\n    rootItems.find((node) => ["special-cell-line-collection", "special-cell-line-collections"].includes(node.path.at(-1) || ""));\n\n  cellLibrary.children = OFFICIAL_CELL_LIBRARY_CHILDREN.map(([slug, title], index) => {\n    const existing = byLeaf.get(slug);\n    if (existing) return { ...existing, title, order: index + 1 };\n    const path = ["cellular-materials", "cell-library-collections", slug];\n    return {\n      key: path.join("/"),\n      _id: `virtual-${path.join("/")}`,\n      title,\n      path,\n      order: index + 1,\n      isVirtual: true,\n      children: [],\n    } as TreeNode;\n  });\n\n  const withoutSpecial = rootItems.filter((node, index) => {\n    if (index === cellLibraryIndex) return true;\n    const leaf = node.path.at(-1) || "";\n    return leaf !== "special-cell-line-collection" && leaf !== "special-cell-line-collections";\n  });\n\n  if (special) {\n    const normalizedSpecial = { ...special, title: "Special Cell Line Collections" };\n    const next = withoutSpecial.filter((node) => node !== special);\n    const insertion = next.findIndex((node) => node.key === cellLibrary.key);\n    next.splice(insertion + 1, 0, normalizedSpecial);\n    return next;\n  }\n\n  return withoutSpecial;\n}\n`;

if (!s.includes('OFFICIAL_CELL_LIBRARY_CHILDREN')) {
  if (!s.includes(helperAnchor)) throw new Error('Cellular helper anchor not found');
  s=s.replace(helperAnchor, helper);
}

const treeOld=`  } else if (activeRoot) {\n    activeRootTree = buildTreeFromDescendants([activeRoot], descendants);\n  }\n\n  const activePageNode = path.length > 1 ? findTreeNodeByPath(activeRootTree, path) : undefined;`;
const treeNew=`  } else if (activeRoot) {\n    activeRootTree = buildTreeFromDescendants([activeRoot], descendants);\n    if (activeRoot === "cellular-materials") {\n      activeRootTree = normalizeOfficialCellularTree(activeRootTree);\n    }\n  }\n\n  const activePageNode = path.length > 1 ? findTreeNodeByPath(activeRootTree, path) : undefined;`;
if (!s.includes('activeRootTree = normalizeOfficialCellularTree(activeRootTree);')) {
  if (!s.includes(treeOld)) throw new Error('activeRootTree anchor not found');
  s=s.replace(treeOld, treeNew);
}

const titleOld=`  const pageTitle = stripBrandSuffix(category?.title || humanizeSegment(path[path.length - 1] || ""));`;
const titleNew=`  const pageTitle = stripBrandSuffix(category?.title || activePageNode?.title || humanizeSegment(path[path.length - 1] || ""));`;
if (s.includes(titleOld)) s=s.replace(titleOld,titleNew);

const fallbackOld=`  const fallbackHtmlRaw = blocks.length\n    ? ""\n    : category?.summary\n      ? \`<p>\${escapeHtml(category.summary)}</p>\`\n      : "";`;
const fallbackNew=`  const virtualCellularSummary = pathStr === "cellular-materials/cell-library-collections/stem-cell-derived-cells"\n    ? "Stem cell-derived models provide lineage-committed, reproducible cell systems for disease modelling, screening, gene editing, and downstream assay development."\n    : "";\n\n  const fallbackHtmlRaw = blocks.length\n    ? ""\n    : category?.summary\n      ? \`<p>\${escapeHtml(category.summary)}</p>\`\n      : virtualCellularSummary\n        ? \`<p>\${escapeHtml(virtualCellularSummary)}</p>\`\n        : "";`;
if (!s.includes('virtualCellularSummary')) {
  if (!s.includes(fallbackOld)) throw new Error('fallback anchor not found');
  s=s.replace(fallbackOld,fallbackNew);
}

fs.writeFileSync(file,s);
console.log('Patched ABM Cell Library Collections to official hierarchy.');
