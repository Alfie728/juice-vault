import { type NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "~/server/auth";

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // "audio" or "cover"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${type}/${session.user.id}/${timestamp}-${sanitizedFileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: "juice-vault",
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "max-age=31536000",
    });

    await s3Client.send(command);

    // Return the public URL
    const publicUrl = `https://juice-vault.s3.ap-southeast-2.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key: key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";