'use server';

import { createHash, randomUUID } from "node:crypto";
import { GoogleGenerativeAI, type Tool } from "@google/generative-ai";
import OpenAI, { toFile } from "openai";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { storage, BUCKET } from "@/lib/gcs";
import { COUNTRY_MAP } from "@/lib/geoUtils";
import { assertUserCanAccessImageKey } from "@/lib/imageAccess";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuthenticatedUser } from "@/lib/serverAuth";
import { checkAndRecordUserUsage } from "@/lib/usageLimits";
import { SAT_AROMA_DEFINITIONS } from "@/constants/sat_aromas";
import { countries, mainVarieties, wineTypes } from "@/constants/wine";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const GEMINI_MODEL = process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.5-flash";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
type OpenAIImageQuality = "low" | "medium" | "high" | "auto";
const OPENAI_IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "high") as OpenAIImageQuality;
const ENABLE_VISUAL_IMAGE_GENERATION = process.env.GENERATE_VISUAL_WINE_IMAGES !== "false";

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

interface GroundingWebChunk {
    web?: {
        uri?: string;
        url?: string;
        title?: string;
    };
}

interface GroundingCapableResponse {
    candidates?: Array<{
        groundingMetadata?: {
            groundingChunks?: GroundingWebChunk[];
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

async function downloadImageFromGcs(imageUrl: string, userId: string): Promise<Buffer> {
    const key = imageUrlToStorageKey(imageUrl);
    await assertUserCanAccessImageKey(userId, key);
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

async function uploadJpegBuffer(buffer: Buffer, prefix: string, userId: string): Promise<{ key: string; url: string }> {
    const now = new Date();
    const key = `uploads/${userId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${randomUUID()}_${prefix}.jpg`;
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
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_label_analysis", {
        metadata: { imageUrl },
    });

    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const key = imageUrlToStorageKey(imageUrl);
    await assertUserCanAccessImageKey(user.id, key);

    // Download image from GCS
    const file = storage.bucket(BUCKET).file(key);
    const [buffer] = await file.download();
    let mimeType = "image/jpeg";
    try {
        const [metadata] = await file.getMetadata();
        if (metadata.contentType) {
            mimeType = metadata.contentType;
        }
    } catch {
        // Fall back to JPEG; existing uploads are commonly JPG/JPEG.
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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
                mimeType,
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

export async function optimizeWineImage(imageUrl: string): Promise<{ optimizedImage: OptimizedWineImage }> {
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_image_optimize", {
        metadata: { imageUrl },
    });

    const originalBuffer = await downloadImageFromGcs(imageUrl, user.id);
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
        uploadJpegBuffer(optimized.buffer, "label_optimized", user.id),
        uploadJpegBuffer(thumbnailBuffer, "label_thumb", user.id),
    ]);

    return {
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

export async function optimizeAndAnalyzeWineImage(imageUrl: string): Promise<WineImageOptimizationAndAnalysis> {
    await requireAuthenticatedUser();

    const optimizedResult = await optimizeWineImage(imageUrl);
    const analysis = await analyzeWineImage(optimizedResult.optimizedImage.url);

    return {
        ...analysis,
        optimizedImage: optimizedResult.optimizedImage,
    };
}


const searchFormFillableFields = [
    'producer',
    'country',
    'locality',
    'region',
    'mainVariety',
    'otherVarieties',
    'additionalInfo',
    'vintage',
    'importer',
    'wineType',
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
] as const;

type SearchFormFillableField = typeof searchFormFillableFields[number];
export type WineSearchFormUpdates = Partial<Record<SearchFormFillableField, unknown>>;

export interface GroundingData {
    terroir_info?: string;
    producer_philosophy?: string;
    technical_details?: string;
    vintage_analysis?: string;
    search_result_tasting_note?: string;
    form_updates?: WineSearchFormUpdates;
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

const searchFormAllowedFields = new Set<string>(searchFormFillableFields);
const searchFormAromaTerms = new Set(
    SAT_AROMA_DEFINITIONS.flatMap((layer) => layer.categories.flatMap((category) => category.terms))
);
const searchFormAromaTermList = Array.from(searchFormAromaTerms).join(', ');

const searchFormStringEnumValues: Partial<Record<SearchFormFillableField, Set<string>>> = {
    wineType: new Set<string>([...wineTypes]),
    country: new Set<string>([...countries]),
    mainVariety: new Set<string>([...mainVarieties]),
    clarity: new Set(['澄んだ', '深みのある', 'やや濁った', '濁った']),
    brightness: new Set(['輝きのある', '艶のある', 'モヤがかった']),
    sparkleIntensity: new Set(['弱い', 'やや弱い', '中程度', 'やや強い', '強い']),
    noseCondition: new Set(['不快 (Unclean)', '良好 (Clean)']),
    development: new Set(['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている']),
};

const searchFormNumberRanges: Partial<Record<SearchFormFillableField, [number, number]>> = {
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
};

const searchFormTextFields = new Set<SearchFormFillableField>([
    'producer',
    'locality',
    'region',
    'otherVarieties',
    'additionalInfo',
    'vintage',
    'importer',
    'appearanceOther',
    'aromaOther',
    'palateNotes',
]);

function parseJsonObject(text: string) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function sanitizeSearchFormUpdates(rawUpdates: unknown): WineSearchFormUpdates {
    if (!rawUpdates || typeof rawUpdates !== 'object') return {};

    const updates: WineSearchFormUpdates = {};

    for (const [key, value] of Object.entries(rawUpdates as Record<string, unknown>)) {
        if (!searchFormAllowedFields.has(key) || value === null || value === undefined || value === '') continue;

        const field = key as SearchFormFillableField;
        const enumValues = searchFormStringEnumValues[field];

        if (enumValues) {
            if (typeof value === 'string' && enumValues.has(value)) {
                updates[field] = value;
            }
            continue;
        }

        const range = searchFormNumberRanges[field];
        if (range) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric >= range[0] && numeric <= range[1]) {
                updates[field] = numeric;
            }
            continue;
        }

        if (field === 'aromas') {
            if (Array.isArray(value)) {
                const aromas = Array.from(new Set(
                    value
                        .filter((item): item is string => typeof item === 'string')
                        .map((item) => item.trim())
                        .filter((item) => item && searchFormAromaTerms.has(item))
                )).slice(0, 20);

                if (aromas.length > 0) {
                    updates.aromas = aromas;
                }
            }
            continue;
        }

        if (searchFormTextFields.has(field)) {
            const text = typeof value === 'string'
                ? value
                : field === 'vintage' && (typeof value === 'number' || typeof value === 'bigint')
                    ? String(value)
                    : '';
            const trimmed = text.trim();
            if (trimmed) {
                updates[field] = trimmed.slice(0, 2000);
            }
        }
    }

    return updates;
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
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_transcript_interpretation", {
        metadata: { transcriptLength: input.transcript.length },
    });

    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const transcript = input.transcript.trim();
    if (!transcript) {
        return { updates: {} };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

export interface VisualWineExplanationRequest {
    name: string;
    producer?: string;
    vintage?: string;
    country?: string;
    locality?: string;
    referenceUrl?: string;
    price?: string | number | null;
}

export interface VisualScale {
    label: string;
    value: number;
    lowLabel: string;
    highLabel: string;
    note: string;
}

export interface TerroirMapCallout {
    label: string;
    description: string;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    icon?: "coast" | "mountain" | "river" | "soil" | "slope" | "climate";
}

export interface VisualImageAsset {
    url?: string;
    prompt?: string;
    caption: string;
    alt?: string;
    sourceTitle?: string;
    sourceUrl?: string;
    kind?: "source" | "generated" | "source-backed-generated";
}

export interface AromaVisual {
    label: string;
    family: "fruit" | "floral" | "spice" | "earth" | "herbal" | "oak" | "mineral" | "other";
    color: string;
    description: string;
    image?: VisualImageAsset;
    presetKey?: string;
}

export interface VisualWineExplanation {
    wine: {
        name: string;
        producer: string;
        vintage: string;
        country: string;
        region: string;
        grapeVarieties: string[];
        style: string;
        classification: string;
        marketPriceJpy?: number | null;
    };
    headline: string;
    lead: string;
    keyTakeaways: string[];
    terroir: {
        title: string;
        summary: string;
        climate: string;
        soil: string;
        mapHint: string;
        mapCallouts?: TerroirMapCallout[];
        influences: { title: string; description: string }[];
    };
    producerStory: {
        summary: string;
        philosophy: string;
        milestones: { year: string; title: string; description: string }[];
    };
    winemaking: {
        summary: string;
        steps: { label: string; description: string }[];
    };
    vintage: {
        summary: string;
        conditions: string[];
    };
    tasting: {
        overview: string;
        aroma: string[];
        aromaVisuals?: AromaVisual[];
        palate: string[];
        finish: string;
        scales: VisualScale[];
    };
    serving: {
        temperature: string;
        glass: string;
        decant: string;
        pairings: string[];
        featuredPairing?: string;
    };
    studyPoints: { title: string; description: string }[];
    sourceNotes: string[];
    sources?: { title: string; url?: string }[];
    visualAssets?: {
        producer?: VisualImageAsset;
        map?: VisualImageAsset;
        aromaBoard?: VisualImageAsset;
        pairing?: VisualImageAsset;
    };
}

function visualWineContextText(query: VisualWineExplanationRequest | undefined, data: VisualWineExplanation) {
    return [
        query?.name,
        query?.producer,
        query?.country,
        query?.locality,
        data.wine.name,
        data.wine.producer,
        data.wine.country,
        data.wine.region,
        data.wine.style,
        data.wine.classification,
        ...(Array.isArray(data.wine.grapeVarieties) ? data.wine.grapeVarieties : []),
    ].filter(Boolean).join(" ");
}

function normalizeVisualScaleValue(value: unknown) {
    const numberValue = finiteNumber(value);
    if (numberValue === null) return 0;
    return clamp(numberValue, 0, 100);
}

function scaleLabelMatches(label: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(label));
}

function contextualVisualScaleCap(label: string, contextText: string) {
    const normalizedLabel = label.trim();
    const isBurgundy = /bourgogne|burgundy|ブルゴーニュ|côte|cote|コート/i.test(contextText);
    const isPinot = /pinot|ピノ/i.test(contextText);
    const isChardonnay = /chardonnay|シャルドネ/i.test(contextText);
    const isWhiteStyle = /white|blanc|bianco|白|chardonnay|シャルドネ|riesling|リースリング|sauvignon|ソ[ーォ]ヴィニヨン/i.test(contextText);
    const isRiesling = /riesling|リースリング/i.test(contextText);

    const isBody = scaleLabelMatches(normalizedLabel, [/ボディ/i, /\bbody\b/i]);
    const isTannin = scaleLabelMatches(normalizedLabel, [/タンニン/i, /\btannin/i]);
    const isAlcohol = scaleLabelMatches(normalizedLabel, [/アルコール/i, /\balcohol/i]);
    const isFruitRipeness = scaleLabelMatches(normalizedLabel, [/果実|熟度/i, /fruit|ripeness/i]);
    const isOak = scaleLabelMatches(normalizedLabel, [/樽/i, /oak/i]);
    const isFinish = scaleLabelMatches(normalizedLabel, [/余韻|フィニッシュ/i, /finish|length/i]);
    const isAcidity = scaleLabelMatches(normalizedLabel, [/酸/i, /acid/i]);

    if (isBurgundy && isPinot) {
        if (isBody) return 58;
        if (isTannin) return 58;
        if (isAlcohol) return 58;
        if (isOak) return 55;
        if (isFruitRipeness) return 68;
        if (isFinish) return 76;
        if (isAcidity) return 84;
    }

    if (isBurgundy && isChardonnay) {
        if (isBody) return 64;
        if (isAlcohol) return 60;
        if (isOak) return 68;
        if (isFruitRipeness) return 70;
        if (isFinish) return 80;
        if (isAcidity) return 86;
        if (isTannin) return 20;
    }

    if (isPinot) {
        if (isBody) return 68;
        if (isTannin) return 66;
        if (isAlcohol) return 66;
    }

    if (isRiesling) {
        if (isBody) return 58;
        if (isAlcohol) return 58;
        if (isOak) return 25;
        if (isAcidity) return 90;
    }

    if (isWhiteStyle && isTannin) return 25;

    return 100;
}

function calibrateVisualTasteScales(query: VisualWineExplanationRequest | undefined, data: VisualWineExplanation) {
    const scales = Array.isArray(data.tasting?.scales) ? data.tasting.scales : [];
    const contextText = visualWineContextText(query, data);

    data.tasting.scales = scales.map((scale) => {
        const value = normalizeVisualScaleValue(scale.value);
        const cappedValue = Math.min(value, contextualVisualScaleCap(scale.label || "", contextText));

        return {
            ...scale,
            value: Math.round(cappedValue),
        };
    });
}

function extractJsonObjectText(text: string) {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("Model response did not contain a JSON object.");
    }

    return cleaned.slice(firstBrace, lastBrace + 1);
}

function parseJsonText<T>(jsonText: string): T {
    return JSON.parse(jsonText) as T;
}

async function parseJsonFromModel<T>(text: string): Promise<T> {
    const jsonText = extractJsonObjectText(text);

    try {
        return parseJsonText<T>(jsonText);
    } catch (initialError) {
        const withoutTrailingCommas = jsonText.replace(/,\s*([}\]])/g, "$1");
        try {
            return parseJsonText<T>(withoutTrailingCommas);
        } catch {
            if (!apiKey) throw initialError;

            const genAI = new GoogleGenerativeAI(apiKey);
            const repairModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
            const repairResult = await repairModel.generateContent(`
Repair the following invalid JSON into strictly valid JSON.
Do not add, remove, summarize, translate, or reinterpret content.
Return only one JSON object, with no markdown fences.

${jsonText}
`);
            const repairResponse = await repairResult.response;
            const repairedText = repairResponse.text();
            return parseJsonText<T>(extractJsonObjectText(repairedText));
        }
    }
}

function extractGroundingSources(response: GroundingCapableResponse): { title: string; url?: string }[] {
    const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!Array.isArray(chunks)) return [];

    const seen = new Set<string>();
    const sources: { title: string; url?: string }[] = [];

    for (const chunk of chunks) {
        const web = chunk?.web;
        const url = web?.uri || web?.url;
        const title = web?.title || url;
        if (!title) continue;

        const key = url || title;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push({ title, url });
    }

    return sources.slice(0, 8);
}

type VisualImageStyle = "editorial" | "photo";
type VisualImageGenerationOptions = {
    allowText?: boolean;
    style?: VisualImageStyle;
    quality?: OpenAIImageQuality;
};

function imagePromptBase(prompt: string, options: VisualImageGenerationOptions = {}) {
    const textRule = options.allowText
        ? "large, short, readable Japanese map labels and callout captions are allowed only for essential terrain features; keep text mobile-readable at 390px screen width"
        : "no readable text and no labels";
    const styleRequirements = options.style === "photo"
        ? [
            "photorealistic overhead flat-lay photograph",
            "natural tabletop surface, soft daylight, realistic shadows, high detail",
            "premium wine tasting workshop reference image, not a digital illustration",
        ]
        : [
            "premium Japanese wine lecture handout visual",
            "modern flat editorial illustration, dark slate-compatible canvas, burgundy primary accents, muted rose and blue-slate supporting colors",
            "minimal texture, clean vector-like fills, high visual clarity, balanced composition",
        ];

    return `${prompt}

Style requirements:
- ${styleRequirements.join("\n- ")}
- ${textRule}
- no logos or watermark`;
}

function openAIImageSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
    if (Math.abs(width - height) < 160) return "1024x1024";
    return width > height ? "1536x1024" : "1024x1536";
}

async function generateCompressedOpenAIImageBuffer(
    prompt: string,
    width = 1200,
    height = 760,
    options: VisualImageGenerationOptions = {}
): Promise<Buffer | null> {
    if (!openaiApiKey || !ENABLE_VISUAL_IMAGE_GENERATION) return null;

    try {
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const result = await openai.images.generate({
            model: OPENAI_IMAGE_MODEL,
            prompt: imagePromptBase(prompt, options),
            quality: options.quality || OPENAI_IMAGE_QUALITY,
            size: openAIImageSize(width, height),
            output_format: "webp",
            output_compression: 86,
            n: 1,
        });
        const base64 = result.data?.[0]?.b64_json;

        if (!base64) return null;

        const original = Buffer.from(base64, "base64");
        const compressed = await sharp(original)
            .resize({ width, height, fit: "cover", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();

        return compressed;
    } catch (error) {
        console.warn("Visual image generation failed:", error);
        return null;
    }
}

async function uploadAiGeneratedImage(buffer: Buffer, prefix: string, userId: string): Promise<string> {
    const now = new Date();
    const key = [
        "ai-explanations",
        userId,
        "visuals",
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, "0"),
        `${Date.now()}_${prefix}_${Math.random().toString(36).slice(2, 9)}.webp`,
    ].join("/");

    await storage.bucket(BUCKET).file(key).save(buffer, {
        metadata: {
            contentType: "image/webp",
            cacheControl: "public, max-age=31536000",
        },
        resumable: false,
    });

    return `/api/images/${key}`;
}

async function generateCompressedOpenAIImageStorageUrl(
    userId: string,
    prompt: string,
    width = 1200,
    height = 760,
    options: VisualImageGenerationOptions & { storagePrefix?: string } = {}
): Promise<string | null> {
    const compressed = await generateCompressedOpenAIImageBuffer(prompt, width, height, options);
    if (!compressed) return null;

    try {
        return await uploadAiGeneratedImage(compressed, options.storagePrefix || "visual", userId);
    } catch (error) {
        console.warn("Failed to upload generated AI explanation image:", error);
        return null;
    }
}

function generatedCacheKey(prefix: string, text: string) {
    const hash = createHash("sha1").update(text.trim().toLowerCase()).digest("hex").slice(0, 14);
    return `${prefix}-${hash}`;
}

async function generateOrReuseStorageImage(
    userId: string,
    subdir: string,
    key: string,
    prompt: string,
    width: number,
    height: number,
    options: VisualImageGenerationOptions = {}
): Promise<string | null> {
    const objectKey = `ai-explanations/${userId}/generated/${subdir}/${key}.webp`;
    const publicPath = `/api/images/${objectKey}`;
    const file = storage.bucket(BUCKET).file(objectKey);

    const [exists] = await file.exists();
    if (exists) {
        return publicPath;
    }

    const buffer = await generateCompressedOpenAIImageBuffer(prompt, width, height, options);
    if (!buffer) return null;

    try {
        await file.save(buffer, {
            metadata: {
                contentType: "image/webp",
                cacheControl: "public, max-age=31536000",
            },
            resumable: false,
        });
        return publicPath;
    } catch (error) {
        console.warn("Failed to save generated image to storage:", error);
        return null;
    }
}

function formatMapRegionLabel(parts: Array<string | undefined | null>) {
    const omittedLabels = new Set(["その他", "不明", "unknown", "n/a", "none", "-"]);
    const seen = new Set<string>();

    return parts
        .map((part) => (part || "").trim())
        .filter((part) => part && !omittedLabels.has(part.toLowerCase()))
        .filter((part) => {
            const key = part.toLowerCase().replace(/\s+/g, " ");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .join(" / ");
}

function buildTerroirMapPrompt(query: VisualWineExplanationRequest, data: VisualWineExplanation) {
    const regionLabel = formatMapRegionLabel([
        data.wine?.country || query.country,
        data.wine?.region || query.locality,
        data.terroir?.title,
    ]);

    const fallbackCallouts: TerroirMapCallout[] = [];
    if (data.terroir?.climate) {
        fallbackCallouts.push({ label: "気候", description: data.terroir.climate });
    }
    if (data.terroir?.soil) {
        fallbackCallouts.push({ label: "土壌", description: data.terroir.soil });
    }
    if (Array.isArray(data.terroir?.influences)) {
        fallbackCallouts.push(
            ...data.terroir.influences.map((item) => ({
                label: item.title,
                description: item.description,
            }))
        );
    }

    const callouts = Array.isArray(data.terroir?.mapCallouts) && data.terroir.mapCallouts.length > 0
        ? data.terroir.mapCallouts
        : fallbackCallouts;

    const calloutLines = callouts
        .slice(0, 3)
        .map((item) => `- ${item.label}: ${item.description}`)
        .join("\n");

    return `Create a geographically grounded illustrated terroir map for ${regionLabel || wineLabelForPrompt(query)}.

Map accuracy and boundary:
- Use the actual wine region as reference: recognizable relative position of coastlines, mountains or hills, valleys, rivers, lakes, important nearby towns, and appellation/vineyard context where relevant.
- Make the target wine-growing area unmistakable: draw its boundary as one continuous burgundy outline with a restrained muted-rose fill, and show the neighboring land outside that boundary in darker slate-neutral tones.
- If the exact vineyard boundary is unknown, show the broader appellation, locality, or administrative wine region accurately and label it as the referenced area.
- Include enough surrounding context that viewers can tell where the region starts and ends.

Terrain readability:
- Use flat modern cartography: elevation should be shown with clean stepped bands and a few restrained contour lines, not realistic relief or paper-map texture.
- Make hills, valleys, slopes, and lowlands clear at thumbnail size.
- Show rivers, lakes, coastlines, and sea areas with muted blue-slate lines/fills; make water visibly different from land.
- Distinguish soil or geological zones with simple flat patterns such as sparse hatching or dot texture. Limestone/chalk/clay/gravel zones should be visibly different from ordinary land.
- Vineyard dots, terraces, or small field marks may be used, but keep them understated and sparse.

Text and captions:
- Add exactly 3 compact Japanese callout caption boxes inside the map, connected with fine leader lines to the relevant terrain areas. Use these callouts:
${calloutLines || "- 地形: 産地の位置関係\n- 気候: 熟度を支える条件\n- 土壌: 味わいの骨格"}
- Callout explanations must be Japanese. Place names must be Japanese plus original name in parentheses when known, for example ウェスト・サセックス (West Sussex).
- Use large sans-serif typography. The image will be shown on smartphones, so text must remain readable at 390px screen width.
- Keep each callout to a short title plus one short sentence. Avoid paragraphs.
- Limit place labels to the target region plus 2 to 4 essential context labels; do not label every town.
- Prefer no legend when the terrain is self-explanatory. A small legend is allowed only if it improves clarity, with at most 3 entries and large icons. The map must remain understandable without relying on the legend.

Visual style:
- This must look like a modern flat editorial regional map for a wine learning note, not a fantasy landscape, not an antique map, and not a satellite photo.
- Use a darker theme-compatible palette: dark slate base, muted slate land, restrained muted rose target region, burgundy boundary/accent, and muted blue-slate water.
- It must sit comfortably on both light and dark themes: avoid pure white backgrounds, pure black backgrounds, parchment texture, metallic gold, high-gloss effects, neon colors, heavy drop shadows, and strong purple/blue gradients.
- Include a small north arrow and optional scale cue. No logos or watermark.`;
}

function buildProducerImagePrompt(
    query: VisualWineExplanationRequest,
    data: VisualWineExplanation,
    asset?: VisualImageAsset
) {
    const producer = data.wine?.producer || query.producer || query.name;
    const region = [data.wine?.country || query.country, data.wine?.region || query.locality]
        .filter(Boolean)
        .join(" / ");
    const sourceContext = [asset?.sourceTitle, asset?.sourceUrl, asset?.caption]
        .filter(Boolean)
        .join(" / ");

    return `${asset?.prompt || `Create a source-backed editorial image of the producer estate, winery building, cellar, and surrounding vineyards for ${producer}.`}
Producer: ${producer}
Region: ${region || "unknown wine region"}
Source context: ${sourceContext || "Use the researched producer story and region context from the page content."}
Make the image feel like a premium wine lecture handout: realistic editorial rendering, vineyard and winery context, no bottle label close-up, no logos, no readable brand marks, no invented people.`;
}

function buildAromaBoardPrompt(query: VisualWineExplanationRequest, data: VisualWineExplanation) {
    const visualAromas = Array.isArray(data.tasting?.aromaVisuals) && data.tasting.aromaVisuals.length > 0
        ? data.tasting.aromaVisuals.map((item) => item.label)
        : [];
    const textAromas = Array.isArray(data.tasting?.aroma) ? data.tasting.aroma : [];
    const aromaObjects = [...visualAromas, ...textAromas]
        .map((item) => item.split(/[、,（(]/)[0]?.trim())
        .filter(Boolean)
        .slice(0, 6);

    return `Create a photorealistic overhead flat-lay aroma image for ${wineLabelForPrompt(query)}.
Arrange these aroma references as real objects on a natural tabletop: ${aromaObjects.join(", ") || "red cherries, raspberries, rose petals, violets, dried herbs, forest floor, spice"}.
Use actual fruits, flowers, herbs, spices, soil/mineral cues, and subtle oak or tea elements when relevant.
Composition: objects neatly placed on a wood or stone table, viewed from directly above, soft window light, realistic shadows, tasting workshop mood.
No text, no labels, no hands, no bottles, no glasses, no logos, no artificial collage look.`;
}

function buildAromaPresetPrompt(aroma: AromaVisual) {
    const objectLabel = aroma.label || aroma.description || "wine aroma reference";
    const familyHint = {
        fruit: "fresh fruit, berries, citrus, orchard fruit, or stone fruit as appropriate",
        floral: "real edible flowers or flower petals with botanical detail",
        spice: "whole spices, cracked pepper, dried spice pieces, or warm baking spice",
        earth: "clean natural earth cues such as forest floor, tea leaves, dried mushrooms, or humus-like texture",
        herbal: "fresh herbs, leaves, stems, or aromatic green elements",
        oak: "vanilla pod, toasted nuts, cedar, oak chips, or gentle baking spice",
        mineral: "clean stones, slate, chalk, sea salt, or wet pebble texture",
        other: "real tasting reference objects",
    }[aroma.family] || "real tasting reference objects";

    return `Create a reusable photorealistic aroma preset image for the wine aroma "${objectLabel}".
Show the aroma as real objects: ${familyHint}.
Composition: overhead tabletop photograph, single clear theme, natural wood or stone surface, soft daylight, realistic shadows, premium wine tasting classroom reference.
Keep it useful as a small UI tile: centered subject, uncluttered background, rich texture, no text, no labels, no hands, no bottles, no glasses, no logos.`;
}

function buildPairingImagePrompt(query: VisualWineExplanationRequest, data: VisualWineExplanation, pairing: string) {
    return `Create a photorealistic plated food pairing image for ${wineLabelForPrompt(query)}.
Dish: ${pairing}.
Wine context: ${data.wine?.style || "wine"} from ${data.wine?.region || query.locality || data.wine?.country || query.country || "the researched region"}.
Composition: premium restaurant table or natural tabletop, realistic dish presentation, soft directional daylight, appetizing but restrained, no text, no menus, no people, no bottle labels, no logos.
The image should explain why this dish fits the wine's acidity, body, tannin, aroma, or texture without adding text.`;
}

async function attachAromaPresetImages(data: VisualWineExplanation, userId: string) {
    const aromas = Array.isArray(data.tasting?.aromaVisuals) ? data.tasting.aromaVisuals.slice(0, 6) : [];
    if (aromas.length === 0) return;

    const withImages = await Promise.all(
        aromas.map(async (aroma) => {
            const key = generatedCacheKey(`aroma-${aroma.family || "other"}`, `${aroma.family}:${aroma.label}:${aroma.description}`);
            const prompt = buildAromaPresetPrompt(aroma);
            const url = await generateOrReuseStorageImage(userId, "aromas", key, prompt, 640, 520, { style: "photo", quality: "medium" });

            return {
                ...aroma,
                presetKey: key,
                image: {
                    url: url || aroma.image?.url,
                    prompt,
                    caption: `${aroma.label}の実写的な香りプリセット`,
                    alt: `${aroma.label}の香りを表す実写的な卓上イメージ`,
                    kind: url ? "generated" as const : aroma.image?.kind,
                },
            };
        })
    );

    data.tasting.aromaVisuals = withImages;
}

async function attachPairingImage(query: VisualWineExplanationRequest, data: VisualWineExplanation, userId: string) {
    data.visualAssets = data.visualAssets || {};
    const pairing = data.serving?.featuredPairing || data.serving?.pairings?.[0];
    if (!pairing) return;

    data.serving.featuredPairing = pairing;
    const prompt = buildPairingImagePrompt(query, data, pairing);
    const key = generatedCacheKey("pairing", `${wineLabelForPrompt(query)}:${pairing}`);
    const url = await generateOrReuseStorageImage(userId, "pairings", key, prompt, 980, 720, { style: "photo", quality: "medium" });

    if (data.visualAssets.pairing) {
        data.visualAssets.pairing.prompt = prompt;
        data.visualAssets.pairing.url = url || data.visualAssets.pairing.url;
        data.visualAssets.pairing.kind = url ? "generated" : data.visualAssets.pairing.kind;
        data.visualAssets.pairing.caption = data.visualAssets.pairing.caption || `${pairing}のAI生成ペアリング画像`;
        data.visualAssets.pairing.alt = data.visualAssets.pairing.alt || `${pairing}の料理写真`;
    } else if (url) {
        data.visualAssets.pairing = {
            url,
            prompt,
            caption: `${pairing}のAI生成ペアリング画像`,
            alt: `${pairing}の料理写真`,
            kind: "generated",
        };
    }
}

function attachVisualPrompts(query: VisualWineExplanationRequest, data: VisualWineExplanation) {
    data.visualAssets = data.visualAssets || {};

    const producerAsset = data.visualAssets.producer;
    const terroirMapPrompt = buildTerroirMapPrompt(query, data);
    const producerImagePrompt = buildProducerImagePrompt(query, data, producerAsset);
    const aromaBoardPrompt = buildAromaBoardPrompt(query, data);

    data.visualAssets.map = {
        ...data.visualAssets.map,
        prompt: terroirMapPrompt,
        caption: data.visualAssets.map?.caption || "AI生成による実在地域ベースのテロワールマップ",
    };

    data.visualAssets.producer = {
        ...producerAsset,
        prompt: producerImagePrompt,
        caption: producerAsset?.caption || "公開情報をもとにしたAI生成の生産者イメージ",
    };

    data.visualAssets.aromaBoard = {
        ...data.visualAssets.aromaBoard,
        prompt: aromaBoardPrompt,
        caption: data.visualAssets.aromaBoard?.caption || "AI生成による代表的な香りのイメージボード",
    };

    return {
        terroirMapPrompt,
        producerImagePrompt,
        aromaBoardPrompt,
    };
}

async function attachVisualImages(query: VisualWineExplanationRequest, data: VisualWineExplanation, userId: string) {
    const {
        terroirMapPrompt,
        producerImagePrompt,
        aromaBoardPrompt,
    } = attachVisualPrompts(query, data);

    data.visualAssets = data.visualAssets || {};

    const mainVisualsPromise = Promise.all([
        generateCompressedOpenAIImageStorageUrl(
            userId,
            terroirMapPrompt,
            1200,
            760,
            { allowText: true, style: "editorial", storagePrefix: "map" }
        ),
        generateCompressedOpenAIImageStorageUrl(
            userId,
            producerImagePrompt,
            1200,
            760,
            { style: "editorial", storagePrefix: "producer" }
        ),
        generateCompressedOpenAIImageStorageUrl(
            userId,
            aromaBoardPrompt,
            1200,
            620,
            { style: "photo", quality: "medium", storagePrefix: "aroma" }
        ),
    ]);
    const cachedVisualsPromise = Promise.all([
        attachAromaPresetImages(data, userId),
        attachPairingImage(query, data, userId),
    ]);
    const [mapImage, producerGeneratedImage, aromaBoardImage] = await mainVisualsPromise;
    await cachedVisualsPromise;

    if (data.visualAssets.map) {
        data.visualAssets.map.url = mapImage || data.visualAssets.map.url;
        data.visualAssets.map.kind = mapImage ? "generated" : data.visualAssets.map.kind;
    }

    if (data.visualAssets.producer) {
        if (producerGeneratedImage) {
            data.visualAssets.producer.url = producerGeneratedImage;
            data.visualAssets.producer.kind = "source-backed-generated";
        }
    }

    if (data.visualAssets.aromaBoard) {
        data.visualAssets.aromaBoard.url = aromaBoardImage || data.visualAssets.aromaBoard.url;
        data.visualAssets.aromaBoard.kind = aromaBoardImage ? "generated" : data.visualAssets.aromaBoard.kind;
    }

    return data;
}

export async function searchWineDetails(wineId: number, query: { name: string; winery?: string; vintage?: string; country?: string; locality?: string; referenceUrl?: string }) {
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_deep_search", {
        metadata: { wineId, name: query.name },
    });

    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
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
    Structured form auto-fill (IMPORTANT):

    In addition to the five reference text fields, return a form_updates object.
    This object is used to pre-fill the normal tasting note form in simple recording mode.

    Only include fields that are supported by the source material or by clearly labeled
    regional/style tendencies at the selected Tier. If the information is uncertain,
    omit the field. Do not output null, unknown, or empty values.

    Conservative rules:
    - Do not update date, place, price, referenceUrl, wineName, rating, notes,
      qualityScore, or readiness.
    - For producer, vintage, importer, grape variety, and exact locality, use Tier0
      or direct input/source information only. Do not infer these identity fields from
      broad regional style.
    - For appearance/aroma/palate numeric scores, use them only when the source gives
      enough evidence to map to the app scale. If the evidence is broader or qualitative,
      prefer the text fields appearanceOther, aromaOther, and palateNotes.
    - Use aromaOther for aroma descriptions that do not exactly match a structured aroma term.
    - Use palateNotes for taste/structure descriptions that are not safe to convert to scores.

    Allowed form_updates fields:
    ${searchFormFillableFields.join(', ')}

    Enum values:
    - wineType: ${wineTypes.join(' | ')}
    - country: ${countries.join(' | ')}
    - mainVariety: ${mainVarieties.join(' | ')}
      If the main grape is not in this list, use 赤その他 or 白その他 only when the color/style is clear,
      and put the exact grape/blend in otherVarieties.
    - clarity: 澄んだ | 深みのある | やや濁った | 濁った
    - brightness: 輝きのある | 艶のある | モヤがかった
    - sparkleIntensity: 弱い | やや弱い | 中程度 | やや強い | 強い
    - noseCondition: 不快 (Unclean) | 良好 (Clean)
    - development: 若い | 熟成中 | 熟成した | ピークを過ぎた/疲れている

    Numeric scales:
    - intensity/color/noseIntensity/acidityScore/tanninScore/bodyScore/finishScore: 0-10
    - oldNewWorld/fruitsMaturity/aromaNeutrality/oakAroma: 1-5
    - sweetness: 1-6 (1=辛口, 2=オフドライ, 3=中辛口, 4=中甘口, 5=甘口, 6=極甘口)
    - alcoholABV: alcohol percentage only

    Qualitative mapping for 0-10 sensory scores:
    low/weak=2, medium(-)=4, medium=5, medium(+)=6.5, high/strong=8, pronounced=9.

    Structured aroma terms:
    ${searchFormAromaTermList}

    --------------------------------------------------
    Output format:

    Return STRICTLY a valid JSON object (no markdown, no code blocks)
    with EXACTLY the following keys:

    1. terroir_info
    2. producer_philosophy
    3. technical_details
    4. vintage_analysis
    5. search_result_tasting_note
    6. form_updates

    The five reference fields must each be a single Japanese text string.
    form_updates must be a JSON object and may be empty: {}.
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
        const cleanedText = cleanJsonText(text);

        const data = JSON.parse(cleanedText) as GroundingData;
        return {
            ...data,
            form_updates: sanitizeSearchFormUpdates(data.form_updates),
        };
    } catch (error: unknown) {
        console.error("Gemini Search Error Full:", error);
        throw new Error(`Failed to fetch wine details: ${getErrorMessage(error)}`);
    }
}

export async function generateVisualWineExplanation(query: VisualWineExplanationRequest): Promise<VisualWineExplanation> {
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_visual_explanation", {
        metadata: { name: query.name },
    });

    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    if (!query.name || query.name.trim().length === 0) {
        throw new Error("Wine name is required.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: [
            {
                googleSearch: {},
            } as unknown as Tool,
        ],
    });

    const prompt = `
    You are creating a Japanese visual wine lecture page for a tasting-note app.
    Use Google Search grounding to research reliable web pages, prioritizing official producer pages,
    technical sheets, importer pages, and professional wine references.

    Wine:
    - Name: ${query.name}
    - Producer: ${query.producer || "Unknown"}
    - Vintage: ${query.vintage || "Unknown"}
    - Country: ${query.country || "Unknown"}
    - Region/Locality: ${query.locality || "Unknown"}
    - User reference URL: ${query.referenceUrl || "None"}
    - Bottle price JPY: ${query.price || "Unknown"}

    Content goal:
    Produce structured Japanese content for a visual HTML page similar to a premium wine lecture handout:
    concise headline, producer story, terroir, climate, winemaking, vintage, tasting profile,
    serving suggestions, study points, and source notes.

    Important accuracy rules:
    - Prefer exact wine + producer + vintage when available.
    - If exact data is insufficient, clearly broaden scope in sourceNotes:
      Tier0 exact wine/producer/vintage, Tier1 appellation/locality, Tier2 sub-region, Tier3 region, Tier4 country/grape.
    - Do not use promotional claims. Use calm, factual, educational Japanese.
    - For tasting profile, distinguish reported/professional notes from general regional tendencies.
    - If a value is inferred, say so in sourceNotes or the relevant note.
    - Keep all strings short enough for card-style UI. Avoid markdown.
    - wine.name must use the same format as the app's AI label search:
      "Original Name (Japanese Name)". If the input already includes Japanese in parentheses, preserve it.
      If Japanese is missing, translate or transliterate it yourself.
    - wine.producer must also use "Original Producer (Japanese Producer)" whenever possible.
      Preserve the original spelling first, then put Japanese in parentheses.
    - If Bottle price JPY is provided, copy it as wine.marketPriceJpy as an integer.
      If it is unknown, estimate the typical Japanese retail bottle price in JPY as a single integer.

    Scale rules:
    - tasting.scales must contain 5 to 7 items.
    - Each value must be an integer from 0 to 100.
    - Values are stored tasting data, not UI emphasis. Treat 50 as medium and 70+ as clearly high/powerful.
    - Calibrate values conservatively against grape, region, and style. Do not inflate every item above 70.
    - For Bourgogne/Burgundy Pinot Noir, body is usually light-to-medium or medium (about 35-60), tannin about 30-60, alcohol about 35-60; reserve 70+ only for genuinely powerful examples.
    - For Bourgogne/Burgundy Chardonnay, body is usually medium (about 40-65); reserve 70+ for richer, warm-vintage or heavily oaked examples.
    - High acidity or long finish can be high when justified, but explain the reason in note.
    - Use labels such as 酸味, 果実の熟度, 樽の存在感, ボディ, タンニン, アルコール感, 余韻.

    Return STRICTLY valid JSON only, with this exact shape:
    {
      "wine": {
        "name": "string",
        "producer": "string",
        "vintage": "string",
        "country": "string",
        "region": "string",
        "grapeVarieties": ["string"],
        "style": "string",
        "classification": "string",
        "marketPriceJpy": 5000
      },
      "headline": "string",
      "lead": "string",
      "keyTakeaways": ["string", "string", "string"],
      "terroir": {
        "title": "string",
        "summary": "string",
        "climate": "string",
        "soil": "string",
        "mapHint": "string",
        "mapCallouts": [
          {
            "label": "海風",
            "description": "短い地形・気候キャプション",
            "position": "top-left",
            "icon": "coast"
          }
        ],
        "influences": [{"title": "string", "description": "string"}]
      },
      "producerStory": {
        "summary": "string",
        "philosophy": "string",
        "milestones": [{"year": "string", "title": "string", "description": "string"}]
      },
      "winemaking": {
        "summary": "string",
        "steps": [{"label": "string", "description": "string"}]
      },
      "vintage": {
        "summary": "string",
        "conditions": ["string"]
      },
      "tasting": {
        "overview": "string",
        "aroma": ["string"],
        "aromaVisuals": [{"label": "string", "family": "fruit", "color": "#b91c1c", "description": "string"}],
        "palate": ["string"],
        "finish": "string",
        "scales": [{"label": "string", "value": 70, "lowLabel": "string", "highLabel": "string", "note": "string"}]
      },
      "serving": {
        "temperature": "string",
        "glass": "string",
        "decant": "string",
        "pairings": ["string"],
        "featuredPairing": "string"
      },
      "studyPoints": [{"title": "string", "description": "string"}],
      "sourceNotes": ["string"],
      "sources": [{"title": "string", "url": "string"}],
      "visualAssets": {
        "producer": {
          "prompt": "source-backed editorial image prompt for the producer estate, winery, cellar, or vineyard",
          "caption": "string",
          "sourceTitle": "official or importer source title",
          "sourceUrl": "official or importer source url"
        },
        "map": {
          "prompt": "image generation prompt for a geographically grounded illustrated regional terroir map with Japanese callout captions",
          "caption": "string"
        },
        "aromaBoard": {
          "prompt": "photorealistic overhead flat-lay image prompt for 4-6 representative aroma objects on a tabletop",
          "caption": "string"
        },
        "pairing": {
          "prompt": "photorealistic plated food pairing image prompt for the one best pairing dish",
          "caption": "string"
        }
      }
    }

    For visualAssets:
    - producer.sourceUrl should prefer the producer's official winery/about page, then importer page.
    - terroir.mapCallouts must contain exactly 3 short terrain features suited for labels inside the map.
      Use positions from top-left, top-right, bottom-left, bottom-right without repeating when possible.
      Use icons from coast, mountain, river, soil, slope, climate.
      Keep label under 8 Japanese characters and description under 18 Japanese characters.
    - map.prompt must describe a geographically grounded illustrated map of the actual region or broader appellation.
      It must make the target wine-growing area boundary unmistakable from surrounding land, preferably with a burgundy outline
      and restrained muted-rose fill. It should mention recognizable coastlines, mountain ranges, hills, rivers, lakes,
      appellation/locality boundaries, sparse vineyard dots/terraces, and exactly 3 short Japanese callout captions.
      It must ask for flat modern cartography: clear elevation bands, a few restrained contour lines, visibly distinct water,
      land, slopes, and soil/geology zones, with no antique paper texture or realistic relief.
      It must keep mobile readability: large sans-serif labels, no paragraphs, at most 3 callout boxes, preferably no legend
      and at most 3 legend entries when needed, and only 2 to 4 essential place labels beyond the target region.
      It must use a darker restrained palette aligned with the app design system: dark slate base, muted slate land,
      muted rose target region, burgundy accents, and muted blue-slate water; avoid metallic gold, neon colors,
      pure black/white backgrounds, parchment texture, heavy shadows, and strong gradients so it works in both light and dark themes.
      Japanese captions are required; place names should be Japanese plus original in parentheses when known.
    - visualAssets.map.caption must be Japanese. If it mentions place names, include Japanese plus original name in parentheses when known.
    - aromaBoard.prompt must name 4-6 real aroma objects from tasting.aromaVisuals.
      The image style should be photorealistic, overhead flat-lay, objects arranged on a wood or stone tabletop,
      with no text, no labels, no hands, no bottles, and no glasses.
    - aromaVisuals must contain 4 to 6 representative aromas that can be rendered as image tiles.
    - serving.featuredPairing must choose exactly one best dish from serving.pairings for a photorealistic food image.
    - visualAssets.pairing.prompt must describe that selected dish as a realistic plated food photograph.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const data = await parseJsonFromModel<VisualWineExplanation>(text);
        const groundedSources = extractGroundingSources(response);

        if ((!data.sources || data.sources.length === 0) && groundedSources.length > 0) {
            data.sources = groundedSources;
        }

        calibrateVisualTasteScales(query, data);
        attachVisualPrompts(query, data);

        return data;
    } catch (error: unknown) {
        console.error("Gemini Visual Explanation Error Full:", error);
        throw new Error(`Failed to generate visual wine explanation: ${getErrorMessage(error)}`);
    }
}

export async function generateVisualWineExplanationImages(
    query: VisualWineExplanationRequest,
    explanation: VisualWineExplanation
): Promise<VisualWineExplanation> {
    const user = await requireAuthenticatedUser();
    await checkAndRecordUserUsage(user.id, "ai_visual_images", {
        metadata: { name: query.name },
    });

    const data = structuredClone(explanation);
    calibrateVisualTasteScales(query, data);

    try {
        return await attachVisualImages(query, data, user.id);
    } catch (error: unknown) {
        console.error("Visual wine image generation error:", error);
        throw new Error(`Failed to generate visual wine images: ${getErrorMessage(error)}`);
    }
}

function wineLabelForPrompt(query: VisualWineExplanationRequest) {
    return [
        query.producer,
        query.name,
        query.vintage,
        query.country,
        query.locality,
    ].filter(Boolean).join(", ");
}

export async function saveGeminiData(wineId: number, data: GroundingData) {
    const user = await requireAuthenticatedUser();
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
        .eq("id", wineId)
        .eq("user_id", user.id);

    if (error) {
        console.error("Supabase Save Error:", error);
        throw new Error("Failed to save data to database.");
    }

    revalidatePath(`/wines/${wineId}`);
}
