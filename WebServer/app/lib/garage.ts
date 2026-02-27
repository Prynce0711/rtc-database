import { S3Client } from "@aws-sdk/client-s3";

export type UploadResult = {
  key: string;
  type: string;
};

export const garage = new S3Client({
  region: "garage",
  endpoint: process.env.GARAGE_ENDPOINT, // e.g. http://garage.local:3900
  credentials: {
    accessKeyId: process.env.GARAGE_ACCESS_KEY!,
    secretAccessKey: process.env.GARAGE_SECRET_KEY!,
  },
  forcePathStyle: true, // REQUIRED for Garage
});
