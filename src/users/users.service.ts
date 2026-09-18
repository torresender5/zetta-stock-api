import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Users, SafeUser } from './interface/user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { UserRole } from './dto/user.dto';

const USER_SAFE_SELECT = {
  id: true,
  user: true,
  email: true,
  role: true,
  createdAt: true,
  companyId: true,
} as const;

type SafeUserRow = {
  id: number;
  user: string;
  email: string;
  role: string;
  createdAt: Date;
  companyId: number | null;
};

function toSafeUser(u: SafeUserRow): SafeUser {
  return {
    id: u.id,
    name: u.user,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    companyId: u.companyId,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private prisma: PrismaService,
  ) {}

  async findAllUsers(companyId?: number) {
    this.logger.info('Starting findAllUsers function');
    return this.prisma.user
      .findMany({
        where: companyId ? { companyId } : {},
        select: USER_SAFE_SELECT,
      })
      .then((rows) => rows.map(toSafeUser));
  }

  async users(
    params: { skip?: number; take?: number },
    companyId?: number,
  ): Promise<SafeUser[]> {
    const { skip, take } = params;
    const rows = await this.prisma.user.findMany({
      skip,
      take,
      where: companyId ? { companyId } : {},
      select: USER_SAFE_SELECT,
    });
    return rows.map(toSafeUser);
  }

  async createUser(data: {
    user: string;
    email: string;
    password: string;
    role: UserRole;
    companyId?: number;
  }) {
    if (!data.companyId) {
      throw new BadRequestException('El usuario debe pertenecer a una empresa');
    }
    try {
      const hashedPassword = bcrypt.hashSync(data.password, 10);
      const created = await this.prisma.user.create({
        data: {
          user: data.user,
          email: data.email,
          password: hashedPassword,
          role: data.role,
          companyId: data.companyId,
        },
        select: USER_SAFE_SELECT,
      });
      return toSafeUser(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El correo ya está registrado');
      }
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(
    actorId: number,
    userId: number,
    data: {
      user?: string;
      email?: string;
      role?: UserRole;
      password?: string;
    },
    companyId?: number,
  ) {
    const user = await this.findById(userId, companyId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const isSelf = actorId === userId;
    try {
      const hashedPassword = data.password
        ? bcrypt.hashSync(data.password, 10)
        : undefined;
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.user !== undefined ? { user: data.user } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          // El admin no puede cambiar su propio rol (evita auto-downgrade)
          ...(!isSelf && data.role !== undefined ? { role: data.role } : {}),
          ...(hashedPassword !== undefined ? { password: hashedPassword } : {}),
        },
        select: USER_SAFE_SELECT,
      });
      return toSafeUser(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async deleteUser(
    actorId: number,
    userId: number,
    companyId?: number,
  ): Promise<void> {
    if (actorId === userId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta');
    }
    const user = await this.findById(userId, companyId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async createUserWithCompany(data: {
    user: string;
    email: string;
    password: string;
    companyData: {
      name: string;
      kind: string;
      document?: string | null;
      phoneNumber?: string | null;
      address?: string | null;
    };
  }) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: data.companyData });
      return tx.user.create({
        data: {
          user: data.user,
          email: data.email,
          password: data.password,
          role: 'admin',
          companyId: company.id,
        },
      });
    });
  }

  async findByEmail(email: string): Promise<Users | undefined | null> {
    return this.prisma.user.findUnique({
      where: {
        email: email,
      },
      include: { company: true },
    });
  }

  async findById(
    id: number,
    companyId?: number,
  ): Promise<Users | undefined | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
    });
  }

  async findByIdWithCompany(
    id: number,
    companyId?: number,
  ): Promise<Users | undefined | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: { company: true },
    });
  }

  async updateProfile(
    userId: number,
    data: { name?: string; email?: string; newPassword?: string },
    currentPassword: string,
    companyId?: number,
  ): Promise<Users> {
    const user = await this.findByIdWithCompany(userId, companyId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
    // Los sub-usuarios (no admin) solo pueden cambiar su contraseña
    if (user.role !== 'admin') {
      data.name = undefined;
      data.email = undefined;
    }
    const hashedPassword = data.newPassword
      ? bcrypt.hashSync(data.newPassword, 10)
      : undefined;
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name !== undefined ? { user: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(hashedPassword !== undefined ? { password: hashedPassword } : {}),
        },
        include: { company: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async updateCompany(
    userId: number,
    data: {
      companyName?: string;
      document?: string;
      phoneNumber?: string;
      address?: string;
    },
    companyId?: number,
  ): Promise<Users> {
    const user = await this.findById(userId, companyId);
    if (!user || !user.companyId) {
      throw new NotFoundException('No se encontró la empresa del usuario');
    }
    await this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        ...(data.companyName !== undefined ? { name: data.companyName } : {}),
        ...(data.document !== undefined ? { document: data.document } : {}),
        ...(data.phoneNumber !== undefined
          ? { phoneNumber: data.phoneNumber }
          : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
      },
    });
    const updated = await this.findByIdWithCompany(userId, companyId);
    if (!updated) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return updated;
  }
}
