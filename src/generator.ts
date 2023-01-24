import { writeFileSync } from "fs";
import { GraphQLInt, GraphQLNonNull, GraphQLString } from "graphql";
import path from "path";
import postgres from "postgres";
import { formatColumnsFields } from "./fields/columns";
import { formatForeignReferenceFields } from "./fields/foreignReferences";
import { formatReferenceFields } from "./fields/references";
import { getQueryField } from "./queryFields";
import { ColumnData, ParseConfig, ReferenceData } from "./types";
import { snakeToPascal } from "./utils";
import { formatWhereCondition } from "./whereCondition";

const SCHEMA_DEFINITION_TEMPLATE = `export const __SCHEMA_NAME__: GraphQLObjectType = new GraphQLObjectType({
  name: "__SCHEMA_NAME__",
  extensions: {
    joinMonster: {
      sqlTable: (args) => {
        return \`(
          SELECT *
          FROM "__TABEL_NAME__"
          WHERE
            __WHERE_CONDITION__

          ORDER BY __ORDER_BY__

          LIMIT CASE
            WHEN \${args.limit !== undefined && typeof args.limit === "number"}
            THEN \${args.limit ?? null}::INT
          END
          OFFSET CASE
            WHEN \${args.offset !== undefined && typeof args.offset === "number"}
            THEN \${args.offset ?? null}::INT
          END
        )\`
      },
      uniqueKey: __UNIQUE_KEY__,
    },
  },
  fields: () => ({__FIELDS__})
});`;

export async function generateSchemas(
  sql: postgres.Sql,
  outFile: string,
  config: ParseConfig
) {
  const tableColumnsMap = await getTablesColumnsMap(sql, config);
  const {
    tableReferencesMap,
    tableForeigReferencesMap,
  } = await getColumnsReferencesMaps(sql);

  const schemas: string[] = [];
  for (const [table, columns] of tableColumnsMap) {
    const references = tableReferencesMap.get(table) ?? [];
    const foreignReferences = tableForeigReferencesMap.get(table) ?? [];
    const schemaName = snakeToPascal(table);
    const whereCondition = formatWhereCondition(columns, table);

    const uniqueKeys = findUniqueColumns(table, columns)
      .map((x) => `"${x}"`)
      .join();

    const columnField = formatColumnsFields(columns);
    const referenceField = formatReferenceFields(references, columns);
    const foreignReferenceField = formatForeignReferenceFields(
      foreignReferences
    );

    const schemaDefinition = SCHEMA_DEFINITION_TEMPLATE.replace(
      /__SCHEMA_NAME__/g,
      schemaName
    )
      .replace(/__TABEL_NAME__/g, table)
      .replace(/__WHERE_CONDITION__/g, whereCondition)
      .replace(/__ORDER_BY__/g, uniqueKeys)
      .replace(/__UNIQUE_KEY__/g, `[${uniqueKeys}]`)
      .replace(
        /__FIELDS__/g,
        `${columnField}${columnField.length > 0 ? "," : ""}
          ${referenceField}${referenceField.length > 0 ? "," : ""}
          ${foreignReferenceField}${
          foreignReferenceField.length > 0 ? "," : ""
        }`
      );

    schemas.push(schemaDefinition);
  }

  const queryFields = getQueryField(tableColumnsMap);

  schemas.push(`
    export function createQueryRoot<T>(resolver: (sql: string) => Promise<T>) {
      return new GraphQLObjectType({
        name: "Query",
        fields: () => ({${queryFields}}),
      });
    }
    `);

  writeFileSync(
    path.resolve(outFile),
    `
import {
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
  GraphQLID,
  GraphQLScalarType,
  GraphQLFloat,
  GraphQLBoolean
} from "graphql";
const GraphQLDate = new GraphQLScalarType({
  name: "GraphQLDate",
});
import joinMonster from "join-monster";
${schemas.join("\n")}
  `.trim()
  );
}

async function getColumnsReferencesMaps(sql: postgres.Sql<{}>) {
  const tableReferencesMap = new Map<string, ReferenceData[]>();
  const tableForeigReferencesMap = new Map<string, ReferenceData[]>();
  const references = await sql<ReferenceData[]>`
    SELECT
      tc.table_name::TEXT,
      kcu.column_name::TEXT,
      ccu.table_name::TEXT AS foreign_table_name,
      ccu.column_name::TEXT AS foreign_column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name != 'passwords';
  `;

  for (const reference of references) {
    const tableReferences = tableReferencesMap.get(reference.table_name) ?? [];
    tableReferences.push(reference);
    tableReferencesMap.set(reference.table_name, tableReferences);

    const tableForeigReferences =
      tableForeigReferencesMap.get(reference.foreign_table_name) ?? [];
    tableForeigReferences.push(reference);
    tableForeigReferencesMap.set(
      reference.foreign_table_name,
      tableForeigReferences
    );
  }
  return { tableReferencesMap, tableForeigReferencesMap };
}

async function getTablesColumnsMap(sql: postgres.Sql<{}>, config: ParseConfig) {
  const exclueTables = config.excludeTables ?? [];
  const tableColumnsMap = new Map<string, ColumnData[]>();
  const tableColumns = await sql<ColumnData[]>`
      SELECT
        information_schema.columns.table_name::TEXT,
        information_schema.columns.column_name::TEXT,
        CASE WHEN is_nullable = 'NO'
            THEN FALSE
            ELSE TRUE
        END AS is_nullable,
        data_type::TEXT,
        EXISTS (
          SELECT 1
          FROM
              information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema=information_schema.columns.table_schema
          AND tc.table_name = information_schema.columns.table_name
          AND kcu.column_name = information_schema.columns.column_name
        ) AS is_primary,
        udt_name::TEXT
      FROM information_schema.columns
      WHERE table_schema = ${config.schemaName}
      AND table_name NOT IN (${exclueTables.join()})
      and ordinal_position > 0
      order by table_name, ordinal_position
  `;

  for (const column of tableColumns) {
    const columnArray = tableColumnsMap.get(column.table_name) ?? [];
    columnArray.push(column);
    tableColumnsMap.set(column.table_name, columnArray);
  }
  return tableColumnsMap;
}

function findUniqueColumns(tableName: string, columns: ColumnData[]): string[] {
  const primaryKeys: string[] = [];
  for (const column of columns) {
    if (column.is_primary) {
      primaryKeys.push(column.column_name);
    }
  }
  if (primaryKeys.length === 0) {
    throw new Error(`No primary column for table ${tableName}`);
  }
  return primaryKeys;
}

function getGraphQLTypeFromColumn(
  column: ColumnData,
  forceNullable?: boolean
): string {
  const type = (() => {
    switch (column.data_type) {
      case "integer":
        return "GraphQLInt";
      case "text":
        return "GraphQLString";
      case "ARRAY":
        return arrayPostgresType(column);
      default:
        throw new Error(
          `Unhandled postgres column type: ${
            column.data_type
          }: ${JSON.stringify(column)}`
        );
    }
  })();

  return column.is_nullable || forceNullable === true
    ? type
    : `new GraphQLNonNull(${type})`;
}

function arrayPostgresType(column: ColumnData) {
  switch (column.udt_name) {
    case "_text":
      return "GraphQLList(GraphQLNonNull(GraphQLString))";
    default:
      throw new Error(
        `Unhandled array type: ${column.udt_name}, column: ${JSON.stringify(
          column
        )}`
      );
  }
}

function postgresArrayTypeToPostgresPrimitive(
  type: string,
  column: ColumnData
): string {
  switch (type) {
    case "_text":
      return "TEXT";
    default:
      throw new Error(
        `Unhandled array type: ${type}, column: ${JSON.stringify(column)}`
      );
  }
}

function postgresTypeToTSType(type: string): string {
  switch (type) {
    case "TEXT":
      return "string";
    default:
      throw new Error(`Unhandled postgres type to TS type: ${type}`);
  }
}
