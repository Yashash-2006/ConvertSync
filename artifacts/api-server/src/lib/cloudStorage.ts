import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { objectStorageClient, ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { Readable } from "stream";
import { logger } from "./logger";

const objectStorageService = new ObjectStorageService();

function parseBucketPath(fullPath: string): { bucketName: string; objectName: string } {
  const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  const parts = normalized.split("/");
  if (parts.length < 3) throw new Error(`Invalid GCS path: ${fullPath}`);
  const bucketName = parts[1];
  const objectName = parts.slice(2).join("/");
  return { bucketName, objectName };
}

function contentTypeForFormat(format: string): string {
  if (format === "pdf") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

/**
 * Upload a converted file from local disk to GCS.
 * Returns the normalized object path (e.g. /objects/uploads/<uuid>)
 * that can be served via GET /api/storage/objects/<path>.
 */
export async function uploadConvertedFile(
  localFilePath: string,
  targetFormat: string,
): Promise<string> {
  const privateObjectDir = objectStorageService.getPrivateObjectDir();
  const objectId = randomUUID();
  const objectKey = `uploads/${objectId}`;

  let dirPath = privateObjectDir;
  if (!dirPath.endsWith("/")) dirPath = `${dirPath}/`;
  const fullGcsPath = `${dirPath}${objectKey}`;

  const { bucketName, objectName } = parseBucketPath(fullGcsPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const gcsFile = bucket.file(objectName);

  const contentType = contentTypeForFormat(targetFormat);

  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(localFilePath);
    const writeStream = gcsFile.createWriteStream({
      contentType,
      resumable: false,
    });
    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    readStream.pipe(writeStream);
  });

  const objectPath = `/objects/${objectKey}`;
  logger.info({ objectPath, localFilePath }, "Uploaded converted file to cloud storage");
  return objectPath;
}

/**
 * Stream a cloud-stored converted file as a download response.
 * Sets Content-Disposition so the browser prompts a save dialog.
 */
export async function streamCloudFile(
  cloudObjectPath: string,
  downloadFilename: string,
  targetFormat: string,
): Promise<{ stream: Readable; contentType: string; contentLength?: number }> {
  const objectFile = await objectStorageService.getObjectEntityFile(cloudObjectPath);
  const [metadata] = await objectFile.getMetadata();

  const contentType = contentTypeForFormat(targetFormat);
  const contentLength = metadata.size ? Number(metadata.size) : undefined;
  const stream = objectFile.createReadStream();

  return { stream, contentType, contentLength };
}

/**
 * Delete a file from GCS by its normalized object path.
 */
export async function deleteCloudFile(cloudObjectPath: string): Promise<void> {
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(cloudObjectPath);
    await objectFile.delete();
    logger.info({ cloudObjectPath }, "Deleted cloud file");
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return;
    logger.warn({ err, cloudObjectPath }, "Failed to delete cloud file");
  }
}
