import { DayPart, EmploymentType, OrgUnitType, PermissionScope, Role } from '@prisma/client';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString,
} from 'class-validator';

// FR-G1 — typy nieobecności
export class CreateAbsenceTypeDto {
  @IsString() name!: string;
  @IsOptional() @IsBoolean() affectsPool?: boolean;
  @IsOptional() @IsBoolean() affectsCapacity?: boolean;
  @IsOptional() @IsBoolean() specialCategory?: boolean;
}
export class UpdateAbsenceTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() affectsPool?: boolean;
  @IsOptional() @IsBoolean() affectsCapacity?: boolean;
  @IsOptional() @IsBoolean() specialCategory?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
}
/** Pełna kolejność typów — tablica identyfikatorów od pierwszego do ostatniego. */
export class ReorderAbsenceTypesDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
}

// FR-G3/G7 — kalendarze i święta
export class CreateCalendarDto {
  @IsString() name!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class CreateHolidayDto {
  @IsString() calendarId!: string;
  @IsString() name!: string;
  @IsDateString() date!: string;
}

// FR-G4 — struktura organizacyjna
export class CreateOrgUnitDto {
  @IsString() name!: string;
  @IsEnum(OrgUnitType) type!: OrgUnitType;
  @IsOptional() @IsString() parentId?: string;
}
export class CreateMembershipDto {
  @IsString() employeeId!: string;
  @IsString() orgUnitId!: string;
}

// FR-G2/B3/B6 — pula
export class SetDefaultPoolDto {
  @IsNumber() value!: number;
}
export class SetAllowanceDto {
  @IsString() employeeId!: string;
  @IsInt() periodYear!: number;
  @IsNumber() baseDays!: number;
  @IsOptional() @IsNumber() overrideDays?: number;
  @IsOptional() @IsNumber() carriedOver?: number;
}

// FR-H5 — logowanie
export class LoginDto {
  @IsString() login!: string;
  @IsString() password!: string;
}
export class SetPasswordDto {
  @IsString() password!: string;
}
export class ChangeEmploymentTypeDto {
  @IsEnum(EmploymentType) employmentType!: EmploymentType;
}
export class ChangeRoleDto {
  @IsEnum(Role) role!: Role;
}
export class GrantPermissionDto {
  @IsEnum(PermissionScope) scope!: PermissionScope;
}

// FR-G5 — pracownicy
export class CreateEmployeeDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;
  @IsString() login!: string;
  @IsEnum(EmploymentType) employmentType!: EmploymentType;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isKeyRole?: boolean;
  @IsOptional() @IsString() holidayCalendarId?: string;
  @IsOptional() @IsString() password?: string;
}

// FR-A1/A3 — wpis nieobecności
export class CreateAbsenceDto {
  @IsString() employeeId!: string;
  @IsString() typeId!: string;
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
  @IsOptional() @IsEnum(DayPart) dayPart?: DayPart;
  @IsOptional() @IsString() hourFrom?: string;
  @IsOptional() @IsString() hourTo?: string;
}
export class UpdateAbsenceDto {
  @IsOptional() @IsString() typeId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsEnum(DayPart) dayPart?: DayPart;
}

// FR-A10 — operacje masowe: jedna nieobecność dla wielu pracowników (np. dzień wolny zespołu).
export class BulkCreateAbsenceDto {
  @IsArray() @IsString({ each: true }) employeeIds!: string[];
  @IsString() typeId!: string;
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
  @IsOptional() @IsEnum(DayPart) dayPart?: DayPart;
  @IsOptional() @IsString() hourFrom?: string;
  @IsOptional() @IsString() hourTo?: string;
}

// FR-J3 — rejestr czynności przetwarzania (RODO)
export class CreateProcessingActivityDto {
  @IsString() name!: string;
  @IsString() purpose!: string;
  @IsString() legalBasis!: string;
  @IsString() dataCategories!: string;
  @IsString() recipients!: string;
  @IsString() retention!: string;
  @IsOptional() @IsBoolean() specialCategory?: boolean;
}

// FR-D4 — sprinty
export class CreateSprintDto {
  @IsString() name!: string;
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
  @IsOptional() @IsString() squadId?: string;
}
