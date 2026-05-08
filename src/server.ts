import { createApp } from "./app.tsx";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

console.log(`listening on :${port}`);
export default { port, fetch: app.fetch };
