// Single source of truth for tag priority ordering.
// love(1) > like(2) > meh(3) > tax_deduction(4)

export const TAG_PRIORITY = { love: 1, like: 2, meh: 3, tax_deduction: 4 };

// SQL CASE expression for use in ORDER BY and subqueries.
// Accepts an optional column prefix (e.g. 'p2.tag') defaulting to 'tag'.
export function tagPrioritySQL(column = 'tag') {
  return `CASE ${column} WHEN 'love' THEN 1 WHEN 'like' THEN 2 WHEN 'meh' THEN 3 WHEN 'tax_deduction' THEN 4 END`;
}
