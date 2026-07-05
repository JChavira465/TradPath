import { IsIn, IsString, MaxLength } from "class-validator";

export class PushTokenDto {
  @IsString()
  @MaxLength(512)
  token!: string;

  @IsIn(["web", "mobile"])
  platform!: "web" | "mobile";
}
