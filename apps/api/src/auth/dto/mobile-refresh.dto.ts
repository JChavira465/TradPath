import { IsOptional, IsString } from "class-validator";

// Mobile has no cookie jar for httpOnly cookies, so it sends the refresh
// token it stored in expo-secure-store directly in the body instead (S2).
export class MobileRefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
