import { Injectable, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Users } from './interface/user.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

    
@Injectable()
export class UsersService {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger, private prisma: PrismaService) {}

  async findAllUsers() {
    this.logger.info('Starting findAllUsers function')
    return this.prisma.user.findMany();
  }

  async users(params: {
    skip?: number;
    take?: number;
    // cursor?: Prisma.UserWhereUniqueInput;
    // where?: Prisma.UserWhereInput;
    // orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<Users[]> {
    const { skip, take} = params;
    return this.prisma.user.findMany({
      skip,
      take,
      // cursor,
      // where,
      // orderBy,
    });
  }

  async createUser(data: { user: string; email: string, password:string }) {
    try{
      console.log('Creating user with data:', data);
      return this.prisma.user.create({data});
    } catch (error) {
      // ERROR LOG
      console.error('Error creating user:', error); }
  }
        
  async findByEmail(email: string): Promise<Users | undefined | null> {
    return this.prisma.user.findUnique({
      where: { 
        email: email
      }
    })
  }

  async findById(id: number): Promise<Users | undefined | null> {
    return this.prisma.user.findUnique({
      where: { 
        id: id
      }
    })
  }
        
        
}

