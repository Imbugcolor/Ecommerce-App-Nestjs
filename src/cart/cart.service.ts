import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cart } from './cart.schema';
import { Model } from 'mongoose';
import { CreateCartDto } from './dto/create-cart.dto';
import { JwtPayload } from 'src/user/auth/jwt-payload.interface';
import { AddCartDto } from './dto/add-cart.dto';
import { ProductsService } from 'src/products/products.service';
import { ItemService } from 'src/item/item.service';
import { VariantService } from 'src/variant/variant.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    private productService: ProductsService,
    private itemService: ItemService,
    private variantService: VariantService,
  ) {}

  async validateCart(userId: string) {
    const fcart = await this.cartModel
      .findOne({ userId })
      .populate({ path: 'items' });

    if (!fcart) return;

    const cart = await fcart.populate([
      {
        path: 'items.productId',
        select: 'product_id price total title images isPublished',
      },
      {
        path: 'items.variantId',
        select: '_id color size inventory productId',
      },
    ]);

    return cart;
  }

  async createCart(createCartDto: CreateCartDto): Promise<Cart> {
    const newCart = new this.cartModel(createCartDto);

    return newCart.save();
  }

  async getCart(user: JwtPayload): Promise<Cart> {
    try {
      let cart = await this.validateCart(user._id);

      if (!cart) {
        const cartData = {
          userId: user._id,
          items: [],
          subTotal: 0,
        };
        return this.createCart(cartData);
      } else {
        await Promise.all(
          cart.items.map(async (item) => {
            if (!item.productId && user) {
              await this.cartModel
                .findOneAndUpdate(
                  { userId: user._id },
                  {
                    $pull: {
                      items: {
                        _id: item._id,
                      },
                    },
                  },
                )
                .populate([
                  {
                    path: 'items.productId',
                    select: 'product_id price total title images isPublished',
                  },
                  {
                    path: 'items.variantId',
                    select: '_id color size inventory productId',
                  },
                ]);

              const newCart = await this.cartModel
                .findOne({ userId: user._id })
                .populate([
                  {
                    path: 'items.productId',
                    select: 'product_id price total title images isPublished',
                  },
                  {
                    path: 'items.variantId',
                    select: '_id color size inventory productId',
                  },
                ]);

              if (newCart) {
                newCart.items.length <= 0
                  ? (newCart.subTotal = 0)
                  : (newCart.subTotal = newCart.items
                      .map((item) => item.total)
                      .reduce((acc, next) => acc + next));

                cart = await newCart.save();
                await cart.populate([
                  {
                    path: 'items.productId',
                    select: 'name price total',
                  },
                  {
                    path: 'items.variantId',
                    select: '_id color size inventory productId',
                  },
                ]);
              }
            }
          }),
        );
      }
      return cart;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException();
    }
  }

  async addCart(addCartDto: AddCartDto, user: JwtPayload): Promise<Cart> {
    const { productId, variantId, quantity } = addCartDto;

    const cart = await this.validateCart(user._id);

    const product = await this.productService.getProduct(productId);

    await this.variantService.validateVariant(variantId);

    if (
      !product.variants.find((variant) => variant._id.toString() === variantId)
    ) {
      throw new NotFoundException('This product not includes this variant id.');
    }

    const newItem = {
      productId,
      variantId,
      quantity,
      price: product.price,
      total: Number(product.price * quantity),
    };

    //--If Cart Exists ----
    if (cart) {
      //---- check if index exists ----
      const indexFound = cart.items.findIndex((item) => {
        return item.variantId._id.toString() === variantId.toString();
      });
      //------this removes an item from the the cart if the quantity is set to zero,We can use this method to remove an item from the list  -------
      if (indexFound !== -1 && quantity <= 0) {
        cart.items.splice(indexFound, 1);
        if (cart.items.length <= 0) {
          cart.subTotal = 0;
        } else {
          cart.subTotal = cart.items
            .map((item) => item.total)
            .reduce((acc, next) => acc + next);
        }
      }
      //----------check if product exist,just add the previous quantity with the new quantity and update the total price-------
      else if (indexFound !== -1) {
        const newItem = {
          quantity: cart.items[indexFound].quantity + quantity,
          total: (cart.items[indexFound].quantity + quantity) * product.price,
          price: product.price,
        };
        const item = await this.itemService.updateItem(
          cart.items[indexFound]._id,
          newItem,
        );

        cart.items[indexFound].quantity = item.quantity;
        cart.items[indexFound].total = item.total;
        cart.items[indexFound].price = item.price;

        cart.subTotal = cart.items
          .map((item) => item.total)
          .reduce((acc, next) => acc + next);
      }
      //----Check if Quantity is Greater than 0 then add item to items Array ----
      else if (quantity > 0) {
        const item = await this.itemService.createItem(newItem);
        cart.items.push(item);
        cart.subTotal = cart.items
          .map((item) => item.total)
          .reduce((acc, next) => acc + next);
      }
      //----if quantity of price is 0 throw the error -------
      else {
        throw new InternalServerErrorException();
      }

      await cart.save();

      return cart.populate([
        {
          path: 'items.productId',
          select: 'product_id price total title images isPublished',
        },
        {
          path: 'items.variantId',
          select: '_id color size inventory productId',
        },
      ]);
    }
    //------------ if there is no user with a cart...it creates a new cart and then adds the item to the cart that has been created------------
    else {
      const item = await this.itemService.createItem(newItem);
      const cartData = {
        userId: user._id,
        items: [item],
        subTotal: Number(product.price * quantity),
      };

      const cart = await this.createCart(cartData);
      return cart.populate([
        {
          path: 'items.productId',
          select: 'product_id price total title images isPublished',
        },
        {
          path: 'items.variantId',
          select: '_id color size inventory productId',
        },
      ]);
      // let data = await cart.save();
    }
  }
}