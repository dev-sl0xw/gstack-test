import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client.ts";

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("migrations applied");
