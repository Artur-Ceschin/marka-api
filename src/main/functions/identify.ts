import awsLambdaFastify from "@fastify/aws-lambda";
import multipart from "@fastify/multipart";
import { buildApp } from "@/main/app";
import { identifyRoutes } from "@/main/routes/identify";

const { app } = buildApp([multipart, identifyRoutes]);

// Without this, API Gateway's base64 body reaches Fastify as a string
// and data.toBuffer() yields garbage instead of a JPEG.
export const handler = awsLambdaFastify(app, {
  binaryMimeTypes: ["image/jpeg", "image/png", "image/webp"],
});

await app.ready();
