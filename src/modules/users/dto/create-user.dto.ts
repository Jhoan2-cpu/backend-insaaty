export class CreateUserDto {
  email: string;
  password: string; // El front envía "password", aunque en DB sea "password_hash"
  fullName: string; // El front envía "fullName"
  tenantId: number; // OJO: Tu esquema usa Int, no String
  roleId: number; // Necesario por tu relación obligatoria
}
