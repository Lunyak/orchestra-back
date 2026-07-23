const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  const apiTarget = process.env.DEV_PROXY_API || "http://localhost:3000";
  const minioTarget = process.env.DEV_PROXY_MINIO || "http://localhost:9000";

  app.use(
    "/api",
    createProxyMiddleware({
      target: apiTarget,
      changeOrigin: true,
    }),
  );

  // Как Caddy: /minio/<bucket>/<key> -> MinIO S3
  app.use(
    "/minio",
    createProxyMiddleware({
      target: minioTarget,
      changeOrigin: true,
      pathRewrite: { "^/minio": "" },
    }),
  );
};
