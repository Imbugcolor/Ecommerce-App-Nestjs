import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './products.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { Roles } from 'src/user/auth/roles.decorator';
import { Role } from 'src/user/role.enum';
import { RolesGuard } from 'src/user/auth/roles.guard';
import { AccessTokenGuard } from 'src/user/auth/accessToken.guard';

@Controller('products')
export class ProductsController {
  constructor(private productService: ProductsService) {}

  @Get()
  async getProducts(): Promise<Product[]> {
    return this.productService.getProducts();
  }

  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.Admin)
  createProduct(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productService.createProduct(createProductDto);
  }
}
