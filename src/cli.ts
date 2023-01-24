#! /usr/bin/env node

import { Command } from "commander";
import postgres from "postgres";
import { generateSchemas } from "./generator";
import { ParseConfig } from "./types";

const defaultConfig: ParseConfig = {
  schemaName: "public",
};

const program = new Command();

program
  .name("Join Monster Schema Generator")
  .description("CLI for auto-generate GraphQL schema with join-monster")
  .version("0.0.1");

program
  .command("generate")
  .description("Generate join-monster friendly schemas from Database")
  .argument("<outputFile>", "Output file")
  .requiredOption("--database-url <connectionString>")
  .requiredOption("--schema-name <schemaName>")
  .action(async (outFile, options) => {
    const sql = postgres(options.databaseUrl);
    await generateSchemas(sql, outFile, {
      schemaName: options.schemaName ?? defaultConfig.schemaName,
    });
    process.exit(0);
  });
program.parse();
