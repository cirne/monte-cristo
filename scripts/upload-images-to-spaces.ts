import "../lib/loadEnv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT;
const SPACES_BUCKET = process.env.SPACES_BUCKET || "monte-cristo";
const SPACES_ACCESS_KEY_ID = process.env.SPACES_ACCESS_KEY_ID;
const SPACES_SECRET_ACCESS_KEY = process.env.SPACES_SECRET_ACCESS_KEY;

console.log(`Using bucket: ${SPACES_BUCKET}`);
console.log(`Using endpoint: ${SPACES_ENDPOINT}`);

if (!SPACES_ENDPOINT || !SPACES_ACCESS_KEY_ID || !SPACES_SECRET_ACCESS_KEY) {
  console.error("Missing SPACES_* environment variables. Check your .env file.");
  process.exit(1);
}

const s3Client = new S3Client({
  endpoint: "https://sfo3.digitaloceanspaces.com", // DigitalOcean Spaces regional endpoint
  region: "us-east-1", // Required by SDK, ignored by Spaces
  credentials: {
    accessKeyId: SPACES_ACCESS_KEY_ID,
    secretAccessKey: SPACES_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false, // DigitalOcean Spaces uses virtual-hosted style
});

const PUBLIC_IMAGES_DIR = join(process.cwd(), "public", "images");
const TARGET_DIRS = ["entities", "scenes"];

async function uploadFile(filePath: string) {
  const relativePath = relative(PUBLIC_IMAGES_DIR, filePath);
  const fileContent = readFileSync(filePath);
  
  console.log(`Uploading ${relativePath}...`);
  
  try {
    const command = new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: relativePath,
      Body: fileContent,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
      ACL: "public-read",
    });

    await s3Client.send(command);
    console.log(`Successfully uploaded ${relativePath}`);
  } catch (error) {
    console.error(`Failed to upload ${relativePath}:`, error);
    throw error;
  }
}

function walkDir(dir: string, callback: (filePath: string) => Promise<void>): Promise<void>[] {
  // This function is no longer used by main(), but keeping for compatibility if needed elsewhere
  return [];
}

async function main() {
  console.log(`Starting migration to DigitalOcean Spaces bucket: ${SPACES_BUCKET}`);
  
  const targetFiles: string[] = [];
  
  for (const target of TARGET_DIRS) {
    const targetPath = join(PUBLIC_IMAGES_DIR, target);
    try {
      if (statSync(targetPath).isDirectory()) {
        console.log(`Walking directory: ${targetPath}`);
        const walk = (dir: string) => {
          const files = readdirSync(dir);
          for (const file of files) {
            const filePath = join(dir, file);
            if (statSync(filePath).isDirectory()) {
              walk(filePath);
            } else if (file.endsWith(".webp")) {
              targetFiles.push(filePath);
            }
          }
        };
        walk(targetPath);
      }
    } catch (e) {
      console.warn(`Directory ${targetPath} not found, skipping.`);
    }
  }

  if (targetFiles.length === 0) {
    console.log("No .webp files found to upload.");
    return;
  }

  console.log(`Found ${targetFiles.length} files to upload.`);
  
  const CONCURRENCY = 20;
  for (let i = 0; i < targetFiles.length; i += CONCURRENCY) {
    const chunk = targetFiles.slice(i, i + CONCURRENCY);
    console.log(`Uploading chunk ${i / CONCURRENCY + 1} of ${Math.ceil(targetFiles.length / CONCURRENCY)}...`);
    try {
      await Promise.all(chunk.map(uploadFile));
    } catch (error) {
      console.error("Migration failed during chunk upload.");
      process.exit(1);
    }
  }

  console.log("Migration completed successfully.");
}

main();
