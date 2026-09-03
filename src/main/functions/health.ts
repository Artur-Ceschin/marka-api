import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "@/main/app";
import { healthRoutes } from "@/main/routes/health";

const { app } = buildApp([healthRoutes]);

export const handler = awsLambdaFastify(app);

await app.ready();
