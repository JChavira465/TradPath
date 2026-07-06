import { PartialType, OmitType } from "@nestjs/mapped-types";
import { CreateFlagDto } from "./create-flag.dto";

export class UpdateFlagDto extends PartialType(OmitType(CreateFlagDto, ["key"] as const)) {}
