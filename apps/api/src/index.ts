import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

const app = createApp();
const { PORT } = getEnv();
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
