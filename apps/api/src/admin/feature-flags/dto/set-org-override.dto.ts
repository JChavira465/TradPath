import { IsBoolean, IsString } from "class-validator";

export class SetOrgOverrideDto {
  @IsString()
  organizationId!: string;

  @IsBoolean()
  enabled!: boolean;
}
