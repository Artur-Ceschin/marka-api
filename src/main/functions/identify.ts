import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "@/main/app";
import { identifyRoutes } from "@/main/routes/identify";

// No multipart and no binaryMimeTypes: images now go straight to S3 via a
// presigned POST, so this function only ever sees JSON carrying the key.
const { app } = buildApp([identifyRoutes]);

export const handler = awsLambdaFastify(app);

await app.ready();
