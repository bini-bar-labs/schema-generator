import { ColumnData, ReferenceData } from "../types";
import { snakeToCamel, snakeToPascal } from "../utils";

export function formatForeignReferenceFields(
  foreignReferences: ReferenceData[]
): string {
  const data: string[] = [];

  for (const foreignReference of foreignReferences) {
    const fieldName = `${snakeToCamel(foreignReference.table_name)}s`;
    const tableEntityName = snakeToPascal(foreignReference.table_name);
    data.push(`
      ${fieldName}: {
        type: new GraphQLList(new GraphQLNonNull(${tableEntityName})),
        extensions: {
          joinMonster: {
            sqlJoin: (origin, foreign, args) => \`\${origin}."${foreignReference.foreign_column_name}" = \${foreign}."${foreignReference.column_name}"\`
          }
        }
      }
    `);
  }
  return data.join(",\n");
}
