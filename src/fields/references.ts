import { ColumnData, ReferenceData } from "../types";
import { snakeToCamel, snakeToPascal } from "../utils";

export function formatReferenceFields(
  references: ReferenceData[],
  columns: ColumnData[]
): string {
  const data: string[] = [];

  for (const reference of references) {
    const fieldName = snakeToCamel(reference.foreign_table_name);
    const referenceColumn = columns.find(
      (x) => x.column_name === reference.foreign_column_name
    );
    if (referenceColumn === undefined) {
      throw new Error("The impossible happened");
    }
    const foreignTableName = snakeToPascal(reference.foreign_table_name);
    const foreignTableEntityName = referenceColumn.is_nullable
      ? foreignTableName
      : `GraphQLNonNull(${foreignTableName})`;
    data.push(`
      ${fieldName}: {
        type: ${foreignTableEntityName},
        extensions: {
          joinMonster: {
            sqlJoin: (origin, foreign, args) => \`\${origin}."${reference.column_name}" = \${foreign}."${reference.foreign_column_name}"\`
          }
        }
      }
    `);
  }
  return data.join(",\n");
}
