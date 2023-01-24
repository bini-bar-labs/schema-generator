# join-monster-generator

CLI tool for automating schema generation for join-monster package over GraphQL

## motivation

Join monster is a package that transform graphql query to sql query/queries by providing the GraphQL schema based on your database.
The issue is that every change to the database you need to modify your schema.
join-monster-generator comes to solves this issue. By reading your database schema join-monster-generator will generate GraphQLSchema with all the relevant relations and filters.

### install

- `npm i --save @bini-bar-labs/join-monster-generator`
- `pnpm add @bini-bar-labs/join-monster-generator`

### Basic Usage

`npx join-monster-generator generate --database-url=<connectionString> --schema-name=<schemasName> ./schemas.ts`
