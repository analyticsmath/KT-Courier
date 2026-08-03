import { prisma } from "@/lib/db/prisma";
import { toUserPublicDto, type UserPublicDto } from "@/lib/dto/user.dto";

export interface UpdateUserInput {
  name?: string;
  phone?: string;
}

export async function getUserById(id: string): Promise<UserPublicDto | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toUserPublicDto(user) : null;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<UserPublicDto> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
    },
  });
  return toUserPublicDto(user);
}
