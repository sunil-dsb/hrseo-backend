import { type Response } from "express";
import { encryptData } from "./encryptDecryptPayload";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: string | null;
}

export async function sendSuccess<T>(res: Response, data?: T, message?: string) {
  let encryptedData;
  if (data) {
    encryptedData = await encryptData(data);
    if (!encryptedData) {
      return sendError(res, 400, "Failed to encrypt response");
    }
  }

  const response: ApiResponse<string> = {
    success: true,
    data: encryptedData ?? null,
    message,
  };

  return res.status(200).json(response);
}

export async function sendError(res: Response, code: number, message: string) {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    message,
  };
  return res.status(code || 500).json(response);
}
