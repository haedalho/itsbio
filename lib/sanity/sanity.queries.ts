export const BRANDS_QUERY = `
*[_type=="brand"] | order(order asc, title asc){
  _id,
  title,
  "slug": slug.current
}
`;
const LIST_QUERY = `
*[_type == "notice" && isActive == true && (!defined($q) || title match $q)] 
| order(order desc, publishedAt desc, _createdAt desc) 
[$start...$end]{
  _id,
  title,
  "slug": slug.current,
  summary,
  publishedAt,
  order,
  thumbnail
}
`;

const COUNT_QUERY = `
count(*[_type == "notice" && isActive == true && (!defined($q) || title match $q)])
`;
