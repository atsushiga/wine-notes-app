'use server';

import { GoogleGenerativeAI, type Tool } from "@google/generative-ai";
import OpenAI, { toFile } from "openai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { storage, BUCKET } from "@/lib/gcs";
import { COUNTRY_MAP } from "@/lib/geoUtils";
import { getSupabaseClient } from "@/lib/supabase";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

export interface WineImageAnalysis {
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    locality_vocab_id?: number | null;
    price: number | null;
}

export interface OptimizedWineImage {
    url: string;
    thumbnail_url: string;
    storage_path: string;
    thumbnail_storage_path: string;
    width: number;
    height: number;
    perspectiveCorrected: boolean;
    brightnessAdjusted: boolean;
    upscaled: boolean;
    optimizationModel: string;
}

export interface WineImageOptimizationAndAnalysis extends WineImageAnalysis {
    optimizedImage: OptimizedWineImage;
}

interface GeoCandidate {
    id: number;
    name: string;
    name_ja: string | null;
    level: string;
    country: string | null;
    parent_hint: string | null;
    similarity: number;
}

interface GeminiSelectionResponse {
    selected_id?: number | null;
    confidence?: number;
    reason?: string;
}

interface ImagePoint {
    x: number;
    y: number;
}

interface LabelCorners {
    topLeft: ImagePoint;
    topRight: ImagePoint;
    bottomRight: ImagePoint;
    bottomLeft: ImagePoint;
}

interface WineLabelVisionResult {
    labelFound?: boolean;
    label_found?: boolean;
    confidence?: number | string;
    labelCorners?: LabelCorners | null;
    label_corners?: LabelCorners | null;
    wineName?: string;
    producer?: string;
    vintage?: string;
    country?: string;
    locality?: string;
    price?: number | string | null;
}

interface ProcessedImageResult {
    buffer: Buffer;
    width: number;
    height: number;
    perspectiveCorrected: boolean;
    brightnessAdjusted: boolean;
    upscaled: boolean;
    optimizationModel: string;
}

interface GeneratedLabelImageResult {
    buffer: Buffer;
    optimizationModel: string;
}

interface GeminiImagePart {
    text?: string;
    inlineData?: {
        data?: string;
        mimeType?: string;
        mime_type?: string;
    };
    inline_data?: {
        data?: string;
        mimeType?: string;
        mime_type?: string;
    };
}

interface GeminiGenerateContentResponse {
    candidates?: Array<{
        content?: {
            parts?: GeminiImagePart[];
        };
    }>;
}

const LABEL_WORKING_MAX_SIDE = 2200;
const LABEL_MIN_SHORT_SIDE = 600;
const LABEL_THUMB_MAX_SIDE = 400;
const GEMINI_IMAGE_EDIT_MODEL = "gemini-3.1-flash-image-preview";
const OPENAI_IMAGE_EDIT_MODEL = "gpt-image-2";
const DETERMINISTIC_IMAGE_OPTIMIZATION_MODEL = "gemini-3.5-flash+sharp";

const LABEL_IMAGE_EDIT_PROMPT = `You are editing a real wine bottle photo for OCR and wine identification.
Create a clean optimized image of only the main wine label (エチケット).

Strict requirements:
- Preserve the actual printed label content exactly: letters, logo, illustration, layout, texture, and all visible marks.
- Do not invent, redraw, translate, stylize, or change any text, logo, or illustration.
- Crop away food, background, table, unrelated objects, and most bottle glass; it is OK if the bottle itself is cut off.
- Keep the complete printed label, including all printed edges and border area. Do not cut off any part of the label.
- Rotate the image so the label text is upright.
- Correct tilt and trapezoid/perspective distortion so the label appears front-facing and rectangular as much as possible.
- Fill any removed, empty, extended, or transparent background area with solid matte black (#000000). Do not use white, gray, gradients, or decorative backgrounds.
- Brighten and improve contrast/sharpness only enough to make the label readable.
- Output a documentary product/OCR image, not an artistic reinterpretation.
- The final image short side should be at least about 600 px.`;

function cleanJsonText(text: string): string {
    const stripped = text.replace(/```json/g, "").replace(/```/g, "").trim();
    if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return stripped;
    return match[0];
}

function imageUrlToStorageKey(imageUrl: string): string {
    const urlParts = imageUrl.split('/api/images/');
    if (urlParts.length < 2 || !urlParts[1]) {
        throw new Error("Invalid image URL format.");
    }

    return decodeURIComponent(urlParts[1].split(/[?#]/)[0]);
}

async function downloadImageFromGcs(imageUrl: string): Promise<Buffer> {
    const key = imageUrlToStorageKey(imageUrl);
    const file = storage.bucket(BUCKET).file(key);
    const [buffer] = await file.download();
    return buffer;
}

function distance(a: ImagePoint, b: ImagePoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim() === "") return null;

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function parsePositiveJpyPrice(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    const normalizedValue = typeof value === "string"
        ? value.trim().replace(/[,\s円¥￥]/g, "")
        : value;

    if (normalizedValue === "") return null;

    const numberValue = Number(normalizedValue);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return null;

    return Math.round(numberValue);
}

function polygonArea(corners: LabelCorners): number {
    const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        area += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area) / 2;
}

function normalizePoint(value: unknown, width: number, height: number): ImagePoint | null {
    if (!value || typeof value !== "object") return null;

    const point = value as { x?: unknown; y?: unknown };
    const x = Number(point.x);
    const y = Number(point.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
        x: clamp(x, 0, width - 1),
        y: clamp(y, 0, height - 1),
    };
}

function normalizeCorners(value: unknown, width: number, height: number): LabelCorners | null {
    if (!value || typeof value !== "object") return null;

    const corners = value as {
        topLeft?: unknown;
        topRight?: unknown;
        bottomRight?: unknown;
        bottomLeft?: unknown;
    };

    const topLeft = normalizePoint(corners.topLeft, width, height);
    const topRight = normalizePoint(corners.topRight, width, height);
    const bottomRight = normalizePoint(corners.bottomRight, width, height);
    const bottomLeft = normalizePoint(corners.bottomLeft, width, height);

    if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;

    const normalized = { topLeft, topRight, bottomRight, bottomLeft };
    const minEdge = Math.min(
        distance(topLeft, topRight),
        distance(topRight, bottomRight),
        distance(bottomRight, bottomLeft),
        distance(bottomLeft, topLeft),
    );

    if (minEdge < 24) return null;
    if (polygonArea(normalized) < width * height * 0.01) return null;

    return normalized;
}

function expandCorners(corners: LabelCorners, width: number, height: number): LabelCorners {
    const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    const center = points.reduce(
        (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
        { x: 0, y: 0 },
    );
    const expandRatio = 1.035;

    const expand = (point: ImagePoint): ImagePoint => ({
        x: clamp(center.x + (point.x - center.x) * expandRatio, 0, width - 1),
        y: clamp(center.y + (point.y - center.y) * expandRatio, 0, height - 1),
    });

    return {
        topLeft: expand(corners.topLeft),
        topRight: expand(corners.topRight),
        bottomRight: expand(corners.bottomRight),
        bottomLeft: expand(corners.bottomLeft),
    };
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] {
    const n = values.length;
    const a = matrix.map((row, index) => [...row, values[index]]);

    for (let column = 0; column < n; column++) {
        let pivotRow = column;
        for (let row = column + 1; row < n; row++) {
            if (Math.abs(a[row][column]) > Math.abs(a[pivotRow][column])) {
                pivotRow = row;
            }
        }

        if (Math.abs(a[pivotRow][column]) < 1e-12) {
            throw new Error("Cannot solve perspective transform.");
        }

        [a[column], a[pivotRow]] = [a[pivotRow], a[column]];

        const pivot = a[column][column];
        for (let col = column; col <= n; col++) {
            a[column][col] /= pivot;
        }

        for (let row = 0; row < n; row++) {
            if (row === column) continue;
            const factor = a[row][column];
            for (let col = column; col <= n; col++) {
                a[row][col] -= factor * a[column][col];
            }
        }
    }

    return a.map((row) => row[n]);
}

function buildHomography(source: ImagePoint[], destination: ImagePoint[]): number[] {
    const matrix: number[][] = [];
    const values: number[] = [];

    for (let i = 0; i < source.length; i++) {
        const src = source[i];
        const dst = destination[i];

        matrix.push([dst.x, dst.y, 1, 0, 0, 0, -src.x * dst.x, -src.x * dst.y]);
        values.push(src.x);
        matrix.push([0, 0, 0, dst.x, dst.y, 1, -src.y * dst.x, -src.y * dst.y]);
        values.push(src.y);
    }

    return solveLinearSystem(matrix, values);
}

function sampleBilinear(
    input: Buffer,
    width: number,
    height: number,
    channels: number,
    x: number,
    y: number,
    channel: number,
): number {
    const x0 = clamp(Math.floor(x), 0, width - 1);
    const y0 = clamp(Math.floor(y), 0, height - 1);
    const x1 = clamp(x0 + 1, 0, width - 1);
    const y1 = clamp(y0 + 1, 0, height - 1);
    const dx = x - x0;
    const dy = y - y0;

    const idx00 = (y0 * width + x0) * channels + channel;
    const idx10 = (y0 * width + x1) * channels + channel;
    const idx01 = (y1 * width + x0) * channels + channel;
    const idx11 = (y1 * width + x1) * channels + channel;

    const top = input[idx00] * (1 - dx) + input[idx10] * dx;
    const bottom = input[idx01] * (1 - dx) + input[idx11] * dx;
    return top * (1 - dy) + bottom * dy;
}

async function warpPerspective(buffer: Buffer, corners: LabelCorners): Promise<{ buffer: Buffer; width: number; height: number }> {
    const sourcePoints = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
    const outputWidth = Math.max(1, Math.round(Math.max(distance(corners.topLeft, corners.topRight), distance(corners.bottomLeft, corners.bottomRight))));
    const outputHeight = Math.max(1, Math.round(Math.max(distance(corners.topLeft, corners.bottomLeft), distance(corners.topRight, corners.bottomRight))));
    const maxSideScale = Math.min(1, LABEL_WORKING_MAX_SIDE / Math.max(outputWidth, outputHeight));
    const width = Math.max(1, Math.round(outputWidth * maxSideScale));
    const height = Math.max(1, Math.round(outputHeight * maxSideScale));
    const destinationPoints = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: width - 1, y: height - 1 },
        { x: 0, y: height - 1 },
    ];
    const transform = buildHomography(sourcePoints, destinationPoints);
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const output = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const denominator = transform[6] * x + transform[7] * y + 1;
            const sourceX = (transform[0] * x + transform[1] * y + transform[2]) / denominator;
            const sourceY = (transform[3] * x + transform[4] * y + transform[5]) / denominator;
            const outputIndex = (y * width + x) * 4;

            for (let channel = 0; channel < 4; channel++) {
                output[outputIndex + channel] = Math.round(sampleBilinear(data, info.width, info.height, info.channels, sourceX, sourceY, channel));
            }
        }
    }

    const jpegBuffer = await sharp(output, {
        raw: {
            width,
            height,
            channels: 4,
        },
    })
        .flatten({ background: "#000000" })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

    return { buffer: jpegBuffer, width, height };
}

async function resizeShortSide(buffer: Buffer, minimumShortSide: number): Promise<{ buffer: Buffer; width: number; height: number; upscaled: boolean }> {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
        throw new Error("Unable to read processed image dimensions.");
    }

    const shortSide = Math.min(width, height);
    if (shortSide >= minimumShortSide) {
        return { buffer, width, height, upscaled: false };
    }

    const scale = minimumShortSide / shortSide;
    const resizedWidth = Math.round(width * scale);
    const resizedHeight = Math.round(height * scale);
    const resizedBuffer = await sharp(buffer)
        .resize(resizedWidth, resizedHeight, {
            fit: "fill",
            kernel: sharp.kernel.lanczos3,
        })
        .sharpen({ sigma: 0.45 })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

    return {
        buffer: resizedBuffer,
        width: resizedWidth,
        height: resizedHeight,
        upscaled: true,
    };
}

async function brightenIfDark(buffer: Buffer): Promise<{ buffer: Buffer; brightnessAdjusted: boolean }> {
    const stats = await sharp(buffer).stats();
    const red = stats.channels[0]?.mean ?? 255;
    const green = stats.channels[1]?.mean ?? red;
    const blue = stats.channels[2]?.mean ?? red;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    let brightness = 1;
    if (luminance < 70) {
        brightness = 1.55;
    } else if (luminance < 95) {
        brightness = 1.35;
    } else if (luminance < 120) {
        brightness = 1.18;
    }

    if (brightness === 1) {
        return { buffer, brightnessAdjusted: false };
    }

    const brightenedBuffer = await sharp(buffer)
        .modulate({ brightness })
        .gamma(1.04)
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

    return { buffer: brightenedBuffer, brightnessAdjusted: true };
}

async function optimizeLabelImage(buffer: Buffer, corners: LabelCorners | null): Promise<ProcessedImageResult> {
    let workingBuffer = await sharp(buffer)
        .rotate()
        .resize({
            width: LABEL_WORKING_MAX_SIDE,
            height: LABEL_WORKING_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    let perspectiveCorrected = false;

    if (corners) {
        const warped = await warpPerspective(workingBuffer, corners);
        workingBuffer = warped.buffer;
        perspectiveCorrected = true;
    }

    const brightened = await brightenIfDark(workingBuffer);
    workingBuffer = brightened.buffer;

    const resized = await resizeShortSide(workingBuffer, LABEL_MIN_SHORT_SIDE);
    workingBuffer = resized.buffer;

    return {
        buffer: workingBuffer,
        width: resized.width,
        height: resized.height,
        perspectiveCorrected,
        brightnessAdjusted: brightened.brightnessAdjusted,
        upscaled: resized.upscaled,
        optimizationModel: DETERMINISTIC_IMAGE_OPTIMIZATION_MODEL,
    };
}

async function normalizeImageForVision(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
    const normalizedBuffer = await sharp(buffer)
        .rotate()
        .resize({
            width: LABEL_WORKING_MAX_SIDE,
            height: LABEL_WORKING_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    const metadata = await sharp(normalizedBuffer).metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error("Unable to read image dimensions.");
    }

    return { buffer: normalizedBuffer, width: metadata.width, height: metadata.height };
}

async function normalizeImageForImageEdit(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .rotate()
        .resize({
            width: LABEL_WORKING_MAX_SIDE,
            height: LABEL_WORKING_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
}

function extractGeminiImageData(response: GeminiGenerateContentResponse): string {
    const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
    const imageData = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;

    if (!imageData) {
        const text = parts.map((part) => part.text).filter(Boolean).join("\n").slice(0, 1000);
        throw new Error(`Gemini image edit returned no image data.${text ? ` Response text: ${text}` : ""}`);
    }

    return imageData;
}

async function generateLabelImageWithGemini(buffer: Buffer): Promise<GeneratedLabelImageResult> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_EDIT_MODEL}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: LABEL_IMAGE_EDIT_PROMPT },
                        {
                            inline_data: {
                                mime_type: "image/png",
                                data: buffer.toString("base64"),
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                responseModalities: ["IMAGE"],
            },
        }),
    });
    const text = await response.text();

    if (!response.ok) {
        throw new Error(`Gemini image edit failed: ${response.status} ${text.slice(0, 1000)}`);
    }

    const json = JSON.parse(text) as GeminiGenerateContentResponse;
    return {
        buffer: Buffer.from(extractGeminiImageData(json), "base64"),
        optimizationModel: GEMINI_IMAGE_EDIT_MODEL,
    };
}

async function generateLabelImageWithOpenAI(buffer: Buffer): Promise<GeneratedLabelImageResult> {
    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
        throw new Error("OPENAI_API_KEY is not set");
    }

    const client = new OpenAI({ apiKey: openAiApiKey });
    const image = await toFile(buffer, "wine-label-input.png", { type: "image/png" });
    const response = await client.images.edit({
        model: OPENAI_IMAGE_EDIT_MODEL,
        image,
        prompt: LABEL_IMAGE_EDIT_PROMPT,
        size: "1024x1536",
        quality: "high",
        output_format: "png",
    });
    const imageData = response.data?.[0]?.b64_json;

    if (!imageData) {
        throw new Error("OpenAI image edit returned no image data.");
    }

    return {
        buffer: Buffer.from(imageData, "base64"),
        optimizationModel: OPENAI_IMAGE_EDIT_MODEL,
    };
}

async function finalizeGeneratedLabelImage(generated: GeneratedLabelImageResult): Promise<ProcessedImageResult> {
    let workingBuffer = await sharp(generated.buffer)
        .rotate()
        .resize({
            width: LABEL_WORKING_MAX_SIDE,
            height: LABEL_WORKING_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

    const brightened = await brightenIfDark(workingBuffer);
    workingBuffer = brightened.buffer;

    const resized = await resizeShortSide(workingBuffer, LABEL_MIN_SHORT_SIDE);

    return {
        buffer: resized.buffer,
        width: resized.width,
        height: resized.height,
        perspectiveCorrected: true,
        brightnessAdjusted: brightened.brightnessAdjusted,
        upscaled: resized.upscaled,
        optimizationModel: generated.optimizationModel,
    };
}

async function optimizeLabelImageWithGenerativeModel(buffer: Buffer): Promise<ProcessedImageResult> {
    try {
        return await finalizeGeneratedLabelImage(await generateLabelImageWithGemini(buffer));
    } catch (geminiError) {
        console.warn("Gemini image edit failed; falling back to OpenAI image edit.", geminiError);
    }

    try {
        return await finalizeGeneratedLabelImage(await generateLabelImageWithOpenAI(buffer));
    } catch (openAiError) {
        console.warn("OpenAI image edit fallback failed; falling back to deterministic image processing.", openAiError);
        throw openAiError;
    }
}

async function analyzeWineLabelWithGeometry(buffer: Buffer, width: number, height: number): Promise<WineLabelVisionResult> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const prompt = `
    You are analyzing a wine label photo for a tasting-note application.
    The image has already been EXIF-rotated and resized to ${width}px wide by ${height}px high.

    Tasks:
    1. Identify the main front wine label (エチケット) that contains the producer, wine name, or appellation.
       - Exclude bottle glass, capsule, hand, table, background, and unrelated price tags.
       - Preserve the complete printed label, including borders and all edge text.
       - If there are multiple labels, choose only the main body/front label, not the neck label.
       - If the label is not rectangular, return a conservative quadrilateral around the whole printed label.
    2. Return the four visible outer corners of that label in pixel coordinates for this ${width}x${height} image.
       - Coordinate origin is top-left.
       - x must be between 0 and ${width - 1}; y must be between 0 and ${height - 1}.
       - Use this exact order: topLeft, topRight, bottomRight, bottomLeft.
       - Be conservative: it is better to include a little bottle/background than to cut off the label.
    3. Extract wine information from the label.
       - wineName format must be "Original Name (Japanese Katakana)".
       - producer format must be "Original Producer (Japanese Katakana)".
       - locality format must be "Original Region/Subregion/Village (Japanese Katakana)".
       - Preserve the original-language label text before the parentheses.
       - Do not return Japanese-only text unless no original-language text is readable.
       - If Japanese is not printed on the label, transliterate or translate it yourself inside parentheses.

    Return STRICTLY valid JSON with this exact shape and no markdown:
    {
      "labelFound": true,
      "confidence": 0.0,
      "labelCorners": {
        "topLeft": { "x": 0, "y": 0 },
        "topRight": { "x": 0, "y": 0 },
        "bottomRight": { "x": 0, "y": 0 },
        "bottomLeft": { "x": 0, "y": 0 }
      },
      "wineName": "Bourgogne Hautes-Côtes de Nuits Blanc (ブルゴーニュ オート・コート・ド・ニュイ ブラン)",
      "producer": "Les Frères Mignon (レ・フレール・ミニョン)",
      "vintage": "2020 or NV",
      "country": "フランス|イタリア|スペイン|ドイツ|オーストリア|スイス|アメリカ|カナダ|チリ|アルゼンチン|オーストラリア|ニュージーランド|日本|南アフリカ|ポルトガル|ギリシャ|ジョージア|その他",
      "locality": "Cumières/Premier Cru (キュミエール/プルミエ・クリュ)",
      "price": 5000
    }

    If the main label cannot be identified, set labelFound to false, confidence below 0.4,
    and use the full image bounds for labelCorners.
    If a field cannot be read, return an empty string for text fields or null for price.
    If you cannot estimate a positive price, return null. Never return 0.
    `;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "image/jpeg",
            },
        },
    ]);
    const response = await result.response;
    const text = response.text();
    return JSON.parse(cleanJsonText(text)) as WineLabelVisionResult;
}

async function uploadJpegBuffer(buffer: Buffer, prefix: string): Promise<{ key: string; url: string }> {
    const now = new Date();
    const key = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${randomUUID()}_${prefix}.jpg`;
    const file = storage.bucket(BUCKET).file(key);

    await file.save(buffer, {
        resumable: false,
        metadata: {
            contentType: "image/jpeg",
            cacheControl: "public, max-age=31536000, immutable",
        },
    });

    return { key, url: `/api/images/${key}` };
}

async function generateServerThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize({
            width: LABEL_THUMB_MAX_SIDE,
            height: LABEL_THUMB_MAX_SIDE,
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
}

async function resolveLocality(countryJa: string, localityText: string): Promise<{ name: string; id: number } | null> {
    if (!localityText || localityText.trim().length === 0) return null;
    // Normalized search term
    const qNorm = localityText.trim().toLowerCase();

    // Resolve country filter
    let targetCountry: string | null = null;
    if (countryJa && COUNTRY_MAP[countryJa] !== undefined) {
        targetCountry = COUNTRY_MAP[countryJa]; // Can be null if 'その他'
    }

    const supabase = getSupabaseClient();

    try {
        // 1. Candidate Retrieval
        const { data: candidateData, error } = await supabase.rpc('search_geo_vocab', {
            search_term: qNorm,
            target_country: targetCountry,
            max_results: 20
        });
        const candidates = (candidateData ?? []) as GeoCandidate[];

        if (error || candidates.length === 0) {
            console.warn("Locality resolution: No candidates or error", error);
            return null;
        }

        // 2. Gemini Re-ranking
        const genAI = new GoogleGenerativeAI(apiKey!);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const candidateListJson = JSON.stringify(candidates.map((c) => ({
            id: c.id,
            primary_label: c.name_ja || c.name,
            name: c.name,
            level: c.level,
            parent_hint: c.parent_hint,
            country: c.country
        })));

        const prompt = `
        You must choose the best matching candidate from the provided list for the given locality.
        
        Input:
        - Extracted Locality: "${localityText}"
        - Extracted Country (JP): "${countryJa}" (Mapped: "${targetCountry || 'None'}")
        - Candidates:
        ${candidateListJson}

        Instructions:
        1. Compare the "Extracted Locality" with the "Candidates".
        2. Select the candidate that represents the same region.
        3. You MUST NOT invent regions or IDs. Select from the list only.
        4. If none match well, return selected_id: null.

        Return JSON ONLY:
        {
            "selected_id": number | null,
            "confidence": number, // 0.0 to 1.0
            "reason": "short explanation <= 200 chars"
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const json = JSON.parse(text) as GeminiSelectionResponse;

        if (json.selected_id) {
            const selected = candidates.find((c) => c.id === json.selected_id);
            if (selected) {
                // Return canonical label: prefer name_ja
                return {
                    name: selected.name_ja || selected.name,
                    id: selected.id
                };
            }
        }

        return null; // Fallback to original text if null returned

    } catch (e) {
        console.error("resolveLocality failed:", e);
        return null;
    }
}

export async function analyzeWineImage(imageUrl: string): Promise<WineImageAnalysis> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    // Extract key from URL
    const urlParts = imageUrl.split('/api/images/');
    if (urlParts.length < 2) {
        throw new Error("Invalid image URL format.");
    }
    const key = decodeURIComponent(urlParts[1]);

    // Download image from GCS
    const file = storage.bucket(BUCKET).file(key);
    const [buffer] = await file.download();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
    Analyze this wine label image and extract the following information.
    Return the result strictly as a valid JSON object.

    1. wineName: The full name of the wine. Format: "Original Name (Japanese Name)". **CRITICAL**: You MUST include the Japanese Katakana translation in parentheses. If it is not on the label, you MUST translate or transliterate it yourself. Example: "Bourgogne Hautes-Côtes de Nuits Blanc (ブルゴーニュ オート・コート・ド・ニュイ ブラン)".
    2. producer: The producer or winery name. Format: "Original Name (Japanese Name)". **CRITICAL**: Include Japanese Katakana translation.
    3. vintage: The vintage year (4 digits, e.g., "2020"). If non-vintage or not found, use "NV".
    4. country: The country of origin. Must be one of: 'フランス', 'イタリア', 'スペイン', 'ドイツ', 'オーストリア', 'スイス', 'アメリカ', 'カナダ', 'チリ', 'アルゼンチン', 'オーストラリア', 'ニュージーランド', '日本', '南アフリカ', 'ポルトガル', 'ギリシャ', 'ジョージア', 'その他'.
    5. locality: The region, district, village, or vineyard. Format: "Region/Subregion/Village" in Original language or English. **CRITICAL**: You MUST include the Japanese Katakana translation in parentheses. Example: "Bourgogne/Côtes de Nuits/Vosne Romanee(ヴォーヌ・ロマネ)".
    6. price: Estimate the market price in Japanese Yen (JPY) as a single integer number (e.g. 5000). Do not include "円" or commas. If unknown or rare, make a reasonable estimate based on the appellation and producer. If you cannot estimate a positive price, return null. Never return 0.

    JSON Keys:
    - wineName
    - producer
    - vintage
    - country
    - locality
    - price
    `;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: buffer.toString("base64"),
                mimeType: "image/jpeg", // Assuming JPEG for simplicity
            },
        },
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsedAnalysis = JSON.parse(cleanedText) as WineImageAnalysis;
    const analysis: WineImageAnalysis = {
        ...parsedAnalysis,
        price: parsePositiveJpyPrice(parsedAnalysis.price),
    };

    // --- Locality Resolution Step ---
    try {
        if (analysis.locality && analysis.country) {
            const result = await resolveLocality(analysis.country, analysis.locality);
            if (result) {
                console.log(`Locality resolved: "${analysis.locality}" -> "${result.name}" (ID: ${result.id})`);
                analysis.locality = result.name;
                analysis.locality_vocab_id = result.id;
            } else {
                console.log(`Locality resolution skipped or failed for "${analysis.locality}"`);
                // Keep original
            }
        }
    } catch (err) {
        console.error("Locality resolution error (non-blocking):", err);
    }

    return analysis;
}

export async function optimizeAndAnalyzeWineImage(imageUrl: string): Promise<WineImageOptimizationAndAnalysis> {
    const originalBuffer = await downloadImageFromGcs(imageUrl);
    const [normalized, imageEditInput] = await Promise.all([
        normalizeImageForVision(originalBuffer),
        normalizeImageForImageEdit(originalBuffer),
    ]);
    const [visionResult, generativeOptimized] = await Promise.all([
        analyzeWineLabelWithGeometry(normalized.buffer, normalized.width, normalized.height),
        optimizeLabelImageWithGenerativeModel(imageEditInput).catch(() => null),
    ]);
    const rawCorners = normalizeCorners(visionResult.labelCorners ?? visionResult.label_corners, normalized.width, normalized.height);
    const labelFound = visionResult.labelFound ?? visionResult.label_found;
    const confidence = finiteNumber(visionResult.confidence) ?? 0;
    const corners = rawCorners && labelFound !== false && confidence >= 0.4
        ? expandCorners(rawCorners, normalized.width, normalized.height)
        : null;
    const optimized = generativeOptimized ?? await optimizeLabelImage(normalized.buffer, corners);
    const thumbnailBuffer = await generateServerThumbnail(optimized.buffer);
    const [uploadedImage, uploadedThumbnail] = await Promise.all([
        uploadJpegBuffer(optimized.buffer, "label_optimized"),
        uploadJpegBuffer(thumbnailBuffer, "label_thumb"),
    ]);

    const analysis: WineImageAnalysis = {
        wineName: visionResult.wineName ?? "",
        producer: visionResult.producer ?? "",
        vintage: visionResult.vintage ?? "",
        country: visionResult.country ?? "",
        locality: visionResult.locality ?? "",
        price: parsePositiveJpyPrice(visionResult.price),
    };

    try {
        if (analysis.locality && analysis.country) {
            const result = await resolveLocality(analysis.country, analysis.locality);
            if (result) {
                console.log(`Locality resolved: "${analysis.locality}" -> "${result.name}" (ID: ${result.id})`);
                analysis.locality = result.name;
                analysis.locality_vocab_id = result.id;
            } else {
                console.log(`Locality resolution skipped or failed for "${analysis.locality}"`);
            }
        }
    } catch (err) {
        console.error("Locality resolution error (non-blocking):", err);
    }

    return {
        ...analysis,
        optimizedImage: {
            url: uploadedImage.url,
            thumbnail_url: uploadedThumbnail.url,
            storage_path: uploadedImage.key,
            thumbnail_storage_path: uploadedThumbnail.key,
            width: optimized.width,
            height: optimized.height,
            perspectiveCorrected: optimized.perspectiveCorrected,
            brightnessAdjusted: optimized.brightnessAdjusted,
            upscaled: optimized.upscaled,
            optimizationModel: optimized.optimizationModel,
        },
    };
}


export interface GroundingData {
    terroir_info?: string;
    producer_philosophy?: string;
    technical_details?: string;
    vintage_analysis?: string;
    search_result_tasting_note?: string;
}

const voiceFillableFields = [
    'clarity',
    'brightness',
    'sparkleIntensity',
    'appearanceOther',
    'intensity',
    'color',
    'noseIntensity',
    'noseCondition',
    'development',
    'oldNewWorld',
    'fruitsMaturity',
    'aromaNeutrality',
    'oakAroma',
    'aromas',
    'aromaOther',
    'sweetness',
    'acidityScore',
    'tanninScore',
    'bodyScore',
    'alcoholABV',
    'finishScore',
    'palateNotes',
    'qualityScore',
    'readiness',
    'rating',
    'notes',
] as const;

type VoiceFillableField = typeof voiceFillableFields[number];
type VoiceUpdates = Partial<Record<VoiceFillableField, unknown>>;

export interface TastingTranscriptInterpretation {
    updates: VoiceUpdates;
    summary?: string;
}

const voiceAllowedFields = new Set<string>(voiceFillableFields);

const stringEnumValues: Partial<Record<VoiceFillableField, Set<string>>> = {
    clarity: new Set(['澄んだ', '深みのある', 'やや濁った', '濁った']),
    brightness: new Set(['輝きのある', '艶のある', 'モヤがかった']),
    sparkleIntensity: new Set(['弱い', 'やや弱い', '中程度', 'やや強い', '強い']),
    noseCondition: new Set(['不快 (Unclean)', '良好 (Clean)']),
    development: new Set(['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている']),
    readiness: new Set(['若すぎる', '今飲めるが熟成可能', '今が飲み頃', '飲み頃を過ぎている']),
};

const numberRanges: Partial<Record<VoiceFillableField, [number, number]>> = {
    intensity: [0, 10],
    color: [0, 10],
    noseIntensity: [0, 10],
    oldNewWorld: [1, 5],
    fruitsMaturity: [1, 5],
    aromaNeutrality: [1, 5],
    oakAroma: [1, 5],
    sweetness: [1, 6],
    acidityScore: [0, 10],
    tanninScore: [0, 10],
    bodyScore: [0, 10],
    alcoholABV: [0, 100],
    finishScore: [0, 10],
    qualityScore: [0, 10],
    rating: [0, 5],
};

function parseJsonObject(text: string) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function sanitizeVoiceUpdates(rawUpdates: unknown): VoiceUpdates {
    if (!rawUpdates || typeof rawUpdates !== 'object') return {};

    const updates: VoiceUpdates = {};

    for (const [key, value] of Object.entries(rawUpdates as Record<string, unknown>)) {
        if (!voiceAllowedFields.has(key) || value === null || value === undefined || value === '') continue;

        const field = key as VoiceFillableField;
        const enumValues = stringEnumValues[field];

        if (enumValues) {
            if (typeof value === 'string' && enumValues.has(value)) {
                updates[field] = value;
            }
            continue;
        }

        const range = numberRanges[field];
        if (range) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric >= range[0] && numeric <= range[1]) {
                updates[field] = numeric;
            }
            continue;
        }

        if (field === 'aromas') {
            if (Array.isArray(value)) {
                const aromas = value
                    .filter((item): item is string => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 20);

                if (aromas.length > 0) {
                    updates.aromas = aromas;
                }
            }
            continue;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
                updates[field] = trimmed.slice(0, 2000);
            }
        }
    }

    return updates;
}

export async function interpretTastingTranscript(input: {
    transcript: string;
    recentText?: string;
    currentValues?: Record<string, unknown>;
}): Promise<TastingTranscriptInterpretation> {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const transcript = input.transcript.trim();
    if (!transcript) {
        return { updates: {} };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    You are helping fill a Japanese wine tasting note form from live speech transcription.
    Interpret only information that is clearly supported by the transcript.

    Important:
    - Return STRICT JSON only. No markdown.
    - Do not output fields outside the allowed field list.
    - Do not update basic information or wine information such as date, place, price, wineName, producer, country, locality, varieties, referenceUrl, importer, or additionalInfo.
    - Prefer preserving currentValues unless the recent transcript clearly corrects or refines them.
    - If the speaker is uncertain, do not output that field.
    - Text fields must be concise Japanese.
    - Numeric sensory fields use the app scales:
      - intensity/color/noseIntensity/acidityScore/tanninScore/bodyScore/finishScore/qualityScore: 0-10
      - oldNewWorld/fruitsMaturity/aromaNeutrality/oakAroma: 1-5
      - sweetness: 1-6
      - alcoholABV: percentage
      - rating: 0-5

    Allowed fields:
    ${voiceFillableFields.join(', ')}

    Enum values:
    - clarity: 澄んだ | 深みのある | やや濁った | 濁った
    - brightness: 輝きのある | 艶のある | モヤがかった
    - sparkleIntensity: 弱い | やや弱い | 中程度 | やや強い | 強い
    - noseCondition: 不快 (Unclean) | 良好 (Clean)
    - development: 若い | 熟成中 | 熟成した | ピークを過ぎた/疲れている
    - readiness: 若すぎる | 今飲めるが熟成可能 | 今が飲み頃 | 飲み頃を過ぎている

    Mapping guidance:
    - Use aromaOther for aroma descriptions if exact structured aroma names are uncertain.
    - Use palateNotes for taste and structure comments that are not direct scores.
    - Use notes for overall conclusion and personal comments.
    - For qualitative intensity terms, choose reasonable scale values:
      low/weak=2, medium(-)=4, medium=5, medium(+)=6.5, high/strong=8, pronounced=9.

    Current values:
    ${JSON.stringify(input.currentValues || {}, null, 2)}

    Recent transcript chunk:
    ${input.recentText || ''}

    Full transcript:
    ${transcript}

    Output format:
    {
      "updates": {
        "fieldName": "value"
      },
      "summary": "short Japanese summary of what was interpreted"
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const parsed = parseJsonObject(response.text()) as { updates?: unknown; summary?: unknown };

        return {
            updates: sanitizeVoiceUpdates(parsed.updates),
            summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : undefined,
        };
    } catch (error: unknown) {
        console.error("Gemini transcript interpretation error:", error);
        throw new Error(`Failed to interpret tasting transcript: ${getErrorMessage(error)}`);
    }
}

export async function searchWineDetails(wineId: number, query: { name: string; winery?: string; vintage?: string; country?: string; locality?: string; referenceUrl?: string }) {
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        tools: [
            {
                googleSearch: {},
            } as unknown as Tool,
        ],
    });

    // Build reference URL instruction
    const referenceUrlInstruction = query.referenceUrl 
        ? `\n\n**CRITICAL - Reference URL (MUST USE):**
    The following URL has been provided as a reference source. You MUST access and reference this URL when searching for information:
    ${query.referenceUrl}
    
    When this URL is available, prioritize information from this source and incorporate it into your analysis. If the URL contains official producer information, technical sheets, or professional reviews, use that as your primary source.`
        : '';

    // Build location context
    const locationContext = (query.country || query.locality) 
        ? `\n\n**Location Context:**
    - Country: ${query.country || "Not specified"}
    - Region/Locality: ${query.locality || "Not specified"}
    
    Use this location information to help determine the appropriate Tier level (Tier1-Tier4) when exact wine information is not available. For example, if the locality is specified (e.g., "Margaux"), you can infer Tier1 (Appellation level) information even if specific producer details are unavailable.`
        : '';

    const prompt = `
    You are assisting a wine tasting note application.
    Search the web for reliable, professional information about the following wine and summarize it in Japanese.

    Wine:
    - Name: ${query.name}
    - Producer/Winery: ${query.winery || "Unknown"}
    - Vintage: ${query.vintage || "Unknown"}${locationContext}${referenceUrlInstruction}

    Goal:
    Create calm, factual “reference material” to support the user’s own tasting notes
    in a SAT / WSET Level 3 context.
    This content is NOT a conclusion or evaluation, but background information.

    --------------------------------------------------
    Critical writing rules (VERY IMPORTANT):
    - Do NOT use promotional or marketing language
    (e.g. 「素晴らしい」「最高」「圧倒的」「世界的に高評価」).
    - Avoid strong conclusions. Prefer cautious phrasing:
    「〜とされる」「〜が見られる」「〜と報告されている」「一般に〜の傾向」.
    - Never tell the user what they “should” taste or conclude.
    - When summarizing tasting notes, distinguish clearly between:
    a) professional reports found online
    b) general regional or stylistic tendencies
    - Use SAT / WSET-style descriptors where appropriate
    (e.g. Medium(+), Pronounced, Long),
    but only when supported by sources or clearly stated as typical style.
    - Keep each section concise and easy to scan.
    - Write in neutral, textbook-like Japanese suitable for exam study.

    --------------------------------------------------
    Fallback search policy (EXTREMELY IMPORTANT):

    If reliable information about the exact wine / producer / vintage
    cannot be found, broaden the scope step-by-step.

    Use this fallback order and DO NOT skip levels unless necessary:

    Tier 0: Exact wine + producer + vintage (most specific)
    Tier 1: Appellation / village / commune (e.g. Margaux AOC)
    Tier 2: Sub-region (e.g. Médoc, Haut-Médoc)
    Tier 3: Regional level (e.g. Bordeaux, Left Bank)
    Tier 4: Country or grape general style (last resort)

    **IMPORTANT - Using Location Information:**
    When country and/or locality information is provided, use it to make more accurate Tier determinations:
    - If locality is specified (e.g., "Margaux", "Napa Valley"), you can confidently use Tier1 (Appellation level) information
    - If only country is specified, use Tier2-Tier3 (Sub-regional or Regional level) information
    - This helps avoid falling back to Tier4 (country/grape general style) unnecessarily

    For EACH field, explicitly state the reference scope
    at the beginning of the text in Japanese, for example:

    「【参照範囲: Tier0（生産者・キュヴェ固有）】」
    「【参照範囲: Tier1（AOC: Margaux）】」
    「【参照範囲: Tier2（地域: Médoc）】」

    If a broader Tier is used, briefly explain why
    (e.g. lack of producer-specific primary sources).
    Never present Tier1–4 information as if it were Tier0 facts.

    --------------------------------------------------
    Field-specific accuracy guidelines (IMPORTANT):

    - terroir_info:
    Tier1–3 information is acceptable and often valuable.
    Start with a short defining sentence (what/where/who) before details.
    Focus on soil, climate, location, and their general implications.

    - producer_philosophy:
    Prefer Tier0 only.
    Start with a short defining sentence (what/where/who) before details.
    Describe producer history, positioning, and winemaking philosophy (if available).
    If unavailable, clearly state that producer-specific philosophy
    could not be confirmed and avoid speculation.

    - technical_details:
    Prefer Tier0.
    This section is especially important for interpreting the tasting note.
    Provide more detailed and informative content than other sections.

    Include, where possible:
        - grape varieties and vine age (if known)
        - yield level (low / controlled / typical, if reported)
        - fermentation vessel and temperature tendency
        - maceration length and extraction style
        - malolactic fermentation details
        - aging vessel type, size, duration, and new oak ratio
        - filtration / fining approach (if mentioned)
        - stylistic intention relevant to structure and aroma

    Avoid speculation, but do not be overly brief.
    This section may be longer and more descriptive than others.

    If unavailable, describe “commonly reported” or “typical” methods
    at the applicable Tier, clearly labeled as such.

    - vintage_analysis:
    Tier2–3 is acceptable and often appropriate.
    Use regional vintage reports when exact producer data is unavailable.

    - search_result_tasting_note:
    Prefer Tier0 professional tasting notes.
    Summarize professional tasting notes found online (aroma / palate / finish / structure).
    Briefly mention acidity, tannin, and finish length using SAT-style terms when reasonably supported.
    If unavailable, summarize commonly reported regional style,
    clearly labeled as general tendency.
    If reports vary, mention the range briefly.

    --------------------------------------------------
    Output format:

    Return STRICTLY a valid JSON object (no markdown, no code blocks)
    with EXACTLY the following keys:

    1. terroir_info
    2. producer_philosophy
    3. technical_details
    4. vintage_analysis
    5. search_result_tasting_note

    Each field must be a single Japanese text string.
    Do not use markdown or code blocks. Use plain text in a structured way.

    --------------------------------------------------
    Missing information handling:

    If information cannot be found even after applying the fallback policy,
    write a short Japanese explanation such as:

    「公開情報から一次ソースで確認できず
    （公式資料・信頼できる専門レビューが見当たらないため）」

    but still provide the most appropriate broader Tier information if possible.

    Overall tone reminder:
    This content functions as background material for study and interpretation,
    similar to a wine exam reference book.
    Clarity and usefulness are more important than brevity.
    `;


    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const data = JSON.parse(cleanedText) as GroundingData;
        return data;
    } catch (error: unknown) {
        console.error("Gemini Search Error Full:", error);
        throw new Error(`Failed to fetch wine details: ${getErrorMessage(error)}`);
    }
}

export async function saveGeminiData(wineId: number, data: GroundingData) {
    const supabase = await createClient();

    const { error } = await supabase
        .from("tasting_notes")
        .update({
            terroir_info: data.terroir_info,
            producer_philosophy: data.producer_philosophy,
            technical_details: data.technical_details,
            vintage_analysis: data.vintage_analysis,
            search_result_tasting_note: data.search_result_tasting_note,
        })
        .eq("id", wineId);

    if (error) {
        console.error("Supabase Save Error:", error);
        throw new Error("Failed to save data to database.");
    }

    revalidatePath(`/wines/${wineId}`);
}
