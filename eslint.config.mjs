import nextVitals from "eslint-config-next/core-web-vitals";
import { globalIgnores } from "eslint/config";

const config = [globalIgnores(["coverage/**", "playwright-report/**", "test-results/**"]), ...nextVitals];

export default config;
