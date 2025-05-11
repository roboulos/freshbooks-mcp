export interface XanoAuthResponse {
  token: string;
  expires_in: number;
  token_type: string;
}

export interface XanoFunction {
  id: string;
  name: string;
  description: string;
  parameters: XanoParameter[];
}

export interface XanoParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface XanoErrorResponse {
  error: string;
  message: string;
  status: number;
}