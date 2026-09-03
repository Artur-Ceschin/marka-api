import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "@/main/app";
import { authRoutes } from "@/main/routes/auth";

const { app } = buildApp([authRoutes]);

export const handler = awsLambdaFastify(app);

await app.ready();
