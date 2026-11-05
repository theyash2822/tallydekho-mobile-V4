// app.json stays the source of truth. The website demo build (EXPO_PUBLIC_DEMO_MODE=1) is a one-page web app
// served from auditer.com/demo, so it needs single-page output and that base path.
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE !== "1") return config;
  return {
    ...config,
    web: { ...config.web, output: "single" },
    experiments: { ...config.experiments, baseUrl: "/demo" },
  };
};
