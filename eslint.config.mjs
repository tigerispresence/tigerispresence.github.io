import nextConfig from "eslint-config-next";
import nextTypescriptConfig from "eslint-config-next/typescript";
import nextCoreWebVitalsConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextConfig,
  ...nextCoreWebVitalsConfig,
  ...nextTypescriptConfig,
];

export default eslintConfig;
