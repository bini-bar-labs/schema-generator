import { postgresToGraphql } from "../consts";
import { ColumnData } from "../types";
import { snakeToCamel } from "../utils";

export function formatColumnsFields(columns: ColumnData[]): string {
  const data: string[] = [];
  for (const column of columns) {
    const fieldName = snakeToCamel(column.column_name);
    const baseGraphqlType = postgresToGraphql[column.udt_name];
    const graphqlType = !column.is_nullable
      ? `new GraphQLNonNull(${baseGraphqlType})`
      : baseGraphqlType;
    data.push(`${fieldName}: {
      type: ${graphqlType},
      extensions: {
        joinMonster: {
          sqlColumn: "${column.column_name}"
        }
      }
    }`);
  }

  return data.join(",\n");
}
