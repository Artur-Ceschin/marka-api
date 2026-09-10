import awsLambdaFastify from "@fastify/aws-lambda";
import multipart from "@fastify/multipart";
import { buildApp } from "@/main/app";
import { identifyRoutes } from "@/main/routes/identify";

const { app } = buildApp([multipart, identifyRoutes]);

export const handler = awsLambdaFastify(app, {
  // Without these, API Gateway's base64 body reaches Fastify as a string and
  // toBuffer() yields garbage instead of a JPEG.
  binaryMimeTypes: ["image/jpeg", "image/png", "image/webp"],
});

await app.ready();
