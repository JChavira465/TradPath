import { IsString } from "class-validator";

// Destructive company actions (archive, delete) require the caller to
// echo back the org's own slug — a lightweight typed-confirmation gate
// so a super admin can't destroy a tenant with a single misclick.
export class TypedConfirmationDto {
  @IsString()
  confirmSlug!: string;
}
