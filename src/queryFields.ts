import { postgresToGraphql } from "./consts";
import { ColumnData } from "./types";
import { snakeToCamel, snakeToPascal } from "./utils";

export function getQueryField(
  tableColumnsMap: Map<string, ColumnData[]>
): string {
  const data: string[] = [];
  for (const [table, columns] of tableColumnsMap) {
    const filedName = snakeToCamel(table);
    const fieldEntityName = snakeToPascal(table);

    const arrayFields = columns.filter((x) => x.data_type === "ARRAY");
    const nonArrayFields = columns.filter((x) => x.data_type !== "ARRAY");
    data.push(`
    ${filedName}s: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(${fieldEntityName}))),
      args: {
        ${nonArrayFields.map(
          (column) => `
          ${snakeToCamel(column.column_name)}: { type: new GraphQLList(${
            postgresToGraphql[column.udt_name]
          }) }
        `
        )},
          ${arrayFields
            .map(
              (column) => `
            ${snakeToCamel(column.column_name)}: {
              type: ${postgresToGraphql[column.udt_name]}
            },
          `
            )
            .join("")}
        limit: {
          type: GraphQLInt
        },
        offset: {
          type: GraphQLInt
        }
      },
      resolve: (_parent, _args, _context, resolveInfo) => joinMonster(resolveInfo, {}, resolver)
    }
  `);
  }

  return data.join(",\n");
}
