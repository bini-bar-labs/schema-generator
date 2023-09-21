import { postgresToTS } from "./consts";
import { ColumnData } from "./types";
import { snakeToCamel } from "./utils";

export function formatWhereCondition(
  columns: ColumnData[],
  table: string
): string {
  const arrayColumns: ColumnData[] = [];
  const nonArrayColumns: ColumnData[] = [];
  for (const column of columns) {
    if (column.data_type === "ARRAY") {
      arrayColumns.push(column);
    } else {
      nonArrayColumns.push(column);
    }
  }

  return [
    nonArrayColumns
      .map((col) => formatNonArrayColumn(table, col))
      .join("\nAND\n"),
    arrayColumns.length > 0 ? "\nAND\n" : "\n",
    arrayColumns.map((col) => formatArrayColumn(table, col)).join("\n"),
  ].join("");
}

function formatNonArrayColumn(table: string, column: ColumnData): string {
  const columnArgName = snakeToCamel(column.column_name);
  return `
  CASE WHEN \${(args.${columnArgName}) === undefined}
    THEN TRUE
    ELSE
      CASE WHEN \${(args.${columnArgName}) === null}
      THEN ${table}."${column.column_name}" IS NULL
      ELSE
        CASE WHEN \${(args.${columnArgName} ?? []).length > 0}
        THEN ${table}."${column.column_name}" = ANY (ARRAY[\${args.${columnArgName} ?? []}]::${column.data_type}[])
        ELSE TRUE
      END
    END
  END
`;
}

function formatArrayColumn(table: string, column: ColumnData): string {
  const columnArgName = snakeToCamel(column.column_name);
  const columnName = column.column_name;
  const TSType = postgresToTS[column.udt_name];
  return `
    CASE WHEN \${args.${columnArgName} !== undefined && Array.isArray(args.${columnArgName})}
      THEN ${table}."${columnName}" && ARRAY[\${(args.${columnArgName} ?? []).map((x: ${TSType}[number]) => "'" + x + "'")}]::${column.data_type}[]
      ELSE TRUE
    END
`;
}
