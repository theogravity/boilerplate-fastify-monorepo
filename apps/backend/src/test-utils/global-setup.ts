import * as path from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kysely, Migrator, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { TypeScriptFileMigrationProvider } from "./ts-migration-transpiler";

global.containers = [];

export async function setup(_config: any) {
  console.log("Setting up global environment");
  const postgresContainer = initializePostgres();

  const startedContainers = await Promise.all([postgresContainer]);

  global.containers.push(...startedContainers);
}

async function initializePostgres() {
  console.log("Starting postgres container");
  const postgresContainer = await new PostgreSqlContainer().start();

  process.env.DB_PORT = postgresContainer.getPort().toString();
  process.env.DB_USER = postgresContainer.getUsername();
  process.env.DB_PASS = postgresContainer.getPassword();
  process.env.DB_NAME = postgresContainer.getDatabase();

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: "localhost",
        port: postgresContainer.getPort(),
        user: postgresContainer.getUsername(),
        password: postgresContainer.getPassword(),
        database: postgresContainer.getDatabase(),
      }),
    }),
  });

  // Run migrations
  const migrator = new Migrator({
    db,
    provider: new TypeScriptFileMigrationProvider(path.join(__dirname, "..", "db", "migrations")),
  });

  console.log("Migrating database");

  const { error } = await migrator.migrateToLatest();

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  return postgresContainer;
}
