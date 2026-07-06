import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status?: string;

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"])
  priority?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
