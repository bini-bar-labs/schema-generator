import { postgresToGraphql } from "./consts";

export interface ColumnData {
  table_name: string;
  column_name: string;
  is_nullable: boolean;
  is_primary: boolean;
  udt_name: keyof typeof postgresToGraphql;
  data_type: string;
}

export interface ReferenceData {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

export interface ParseConfig {
  schemaName: string;
  excludeTables?: string[];
}
