import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { resumesTable } from "@workspace/db";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "no_file", message: "No file uploaded" });
      return;
    }

    const fileContent = req.file.buffer.toString("base64");

    const [resume] = await db
      .insert(resumesTable)
      .values({
        filename: req.file.originalname,
        originalName: req.file.originalname,
        filePath: "db",
        fileContent,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      })
      .returning();

    res.json({
      resumeId: resume.id,
      filename: resume.originalName,
      message: "Resume uploaded successfully",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    res.status(400).json({ error: "upload_failed", message: msg });
  }
});

export default router;
