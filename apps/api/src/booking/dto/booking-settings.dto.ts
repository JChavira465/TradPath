import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from "class-validator";

export class BookingSettingsDto {
  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bookingSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  bookingPageTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bookingPageDescription?: string;

  @IsOptional()
  @IsString()
  bookingPageLogo?: string;

  @IsOptional()
  @IsHexColor()
  bookingPageColor?: string;
}
