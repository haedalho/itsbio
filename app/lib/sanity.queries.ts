export const BRANDS_QUERY = `
*[_type=="brand"] | order(order asc, title asc){
  _id,
  title,
  "slug": slug.current,
  introTitle,
  introDesc,
  themeKey
}
`;