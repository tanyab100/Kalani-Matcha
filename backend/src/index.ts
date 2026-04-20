import "dotenv/config";
import { app } from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, () => {
  console.log(`Matcha backend listening on port ${PORT}`);
});
